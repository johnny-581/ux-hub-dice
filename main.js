const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');

const CONFIG = require('./config');

let win = null;

// --- remembered position ---------------------------------------------------

const positionFile = () => path.join(app.getPath('userData'), 'position.json');

function loadSavedPosition() {
  try {
    const { x, y } = JSON.parse(fs.readFileSync(positionFile(), 'utf8'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // A display may have been unplugged since last launch.
    const { width: w, height: h } = CONFIG.WINDOW;
    const onSomeDisplay = screen.getAllDisplays().some(({ bounds: b }) =>
      x + w > b.x && x < b.x + b.width && y + h > b.y && y < b.y + b.height);
    return onSomeDisplay ? { x, y } : null;
  } catch {
    return null; // first launch, or unreadable — fall back to CONFIG.POSITION
  }
}

function savePosition() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(positionFile(), JSON.stringify({ x, y }));
  } catch (error) {
    console.warn('Could not save position:', error.message);
  }
}

function computeBounds() {
  const { width: w, height: h } = CONFIG.WINDOW;
  const { anchor, insetX, insetY } = CONFIG.POSITION;

  // Full display bounds, not workArea: during a fullscreen presentation the
  // menu bar and Dock are gone, and this widget only matters while presenting.
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  const left = x + insetX;
  const right = x + width - w - insetX;
  const top = y + insetY;
  const bottom = y + height - h - insetY;

  const spots = {
    'bottom-right': { x: right, y: bottom },
    'bottom-left': { x: left, y: bottom },
    'top-right': { x: right, y: top },
    'top-left': { x: left, y: top },
    center: { x: x + Math.round((width - w) / 2), y: y + Math.round((height - h) / 2) },
  };

  const spot = spots[anchor] || spots['bottom-right'];
  return { x: Math.round(spot.x), y: Math.round(spot.y), width: w, height: h };
}

function createWindow() {
  win = new BrowserWindow({
    ...computeBounds(),
    ...(loadSavedPosition() || {}), // where you last dragged it wins
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false, // shadows on transparent macOS windows artifact badly
    resizable: false,
    movable: true, // we reposition it ourselves via setPosition
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false, // Keynote keeps keyboard focus; arrow keys still advance slides
    acceptFirstMouse: true, // without this the first click only activates, it doesn't land
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // The three calls the probe validated, plus transparency.
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Default to fully click-through. `forward: true` keeps mousemove flowing to
  // the renderer so it can tell us when the cursor is over an actual button.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile('index.html');
  win.on('closed', () => {
    win = null;
  });
}

// Renderer says "the cursor is over a button" / "it left".
ipcMain.on('set-interactive', (_event, interactive) => {
  if (!win || win.isDestroyed()) return;
  if (interactive) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

// --- drag to reposition ----------------------------------------------------
// Driven from here rather than with -webkit-app-region: drag, which doesn't
// work on a click-through, non-focusable window. Polling the real cursor
// position avoids any question of which coordinate space the renderer reports.

let dragTimer = null;
let dragWatchdog = null;

function stopDrag() {
  if (dragTimer) clearInterval(dragTimer);
  if (dragWatchdog) clearTimeout(dragWatchdog);
  dragTimer = null;
  dragWatchdog = null;
  savePosition();
}

ipcMain.on('drag-start', () => {
  if (!win || win.isDestroyed() || dragTimer) return;

  const grab = screen.getCursorScreenPoint();
  const [originX, originY] = win.getPosition();
  const { width: w, height: h } = CONFIG.WINDOW;
  const slack = CONFIG.DRAG_OVERHANG || { x: 0, y: 0 };

  dragTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return stopDrag();

    const cursor = screen.getCursorScreenPoint();
    // Clamp to whichever display the cursor is over, so it can't be dropped
    // somewhere unreachable. Recomputed each tick, so dragging across to a
    // second display still works.
    //
    // The bounds are widened by DRAG_OVERHANG because the window is larger
    // than the art it contains: clamping the window itself would stop the
    // visible ink ~80px short of every screen edge.
    const b = screen.getDisplayNearestPoint(cursor).bounds;
    const minX = b.x - slack.x;
    const maxX = b.x + b.width - w + slack.x;
    const minY = b.y - slack.y;
    const maxY = b.y + b.height - h + slack.y;
    const x = Math.max(minX, Math.min(originX + (cursor.x - grab.x), maxX));
    const y = Math.max(minY, Math.min(originY + (cursor.y - grab.y), maxY));

    win.setPosition(Math.round(x), Math.round(y));
  }, 16);

  // If a mouseup is ever missed, don't let the window follow the cursor forever.
  dragWatchdog = setTimeout(stopDrag, 30000);
});

ipcMain.on('drag-end', stopDrag);

function send(action) {
  if (win && !win.isDestroyed()) win.webContents.send('hotkey', action);
}

function registerHotkeys() {
  const bindings = [
    [CONFIG.HOTKEYS.roll, () => send('roll')],
    [CONFIG.HOTKEYS.dismiss, () => send('dismiss')],
    [CONFIG.HOTKEYS.quit, () => app.quit()],
  ];

  for (const [accelerator, handler] of bindings) {
    if (!accelerator) continue;
    if (!globalShortcut.register(accelerator, handler)) {
      console.warn(`Could not register hotkey ${accelerator} — another app likely owns it.`);
    }
  }
}

app.whenReady().then(() => {
  app.dock.hide(); // no Dock icon, no menu bar takeover
  createWindow();
  registerHotkeys();

  console.log(`ux-hub-dice ready — ${CONFIG.HOTKEYS.roll} to pick, ` +
    `${CONFIG.HOTKEYS.dismiss} to dismiss, ${CONFIG.HOTKEYS.quit} to quit.`);
});

app.on('before-quit', savePosition);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
