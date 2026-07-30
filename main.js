const fs = require('fs');
const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
} = require('electron');

const CONFIG = require('./config');

let win = null;
let tray = null; // module scope, or it gets garbage collected and vanishes

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
    // NSPanel with the non-activating mask. Without this, clicking anywhere on
    // the window activates the app and Keynote loses keyboard focus — arrow
    // keys stop advancing slides. focusable: false only stops the *window*
    // becoming key; it doesn't stop the *app* being activated by a click.
    type: 'panel',
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false, // shadows on transparent macOS windows artifact badly
    // Shown later with showInactive(). The default (show: true) calls
    // makeKeyAndOrderFront, which activates the app and pulls focus off
    // whatever you were presenting — LSUIElement stops the Dock icon, not the
    // activation.
    show: false,
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

  // showInactive() puts it on screen without making it key or activating the
  // app, so the frontmost app keeps focus.
  win.once('ready-to-show', () => {
    win.showInactive();
    refreshTrayMenu();
  });

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

// --- menu bar ---------------------------------------------------------------

function setWidgetVisible(visible) {
  if (!win || win.isDestroyed()) return;
  // showInactive, never show — the latter would activate the app and take
  // keyboard focus off the slides.
  if (visible) win.showInactive();
  else win.hide();
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  const visible = !!win && !win.isDestroyed() && win.isVisible();

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show widget',
        type: 'checkbox',
        checked: visible,
        click: () => setWidgetVisible(!visible),
      },
      { type: 'separator' },
      // The accelerator is spelled into the label rather than set as one: a
      // real accelerator here could collide with the global shortcut.
      { label: `Quit  (${CONFIG.HOTKEYS.quit})`, click: () => app.quit() },
    ])
  );
}

function trayIcon() {
  try {
    // Read through fs so this works identically inside app.asar.
    const buffer = fs.readFileSync(path.join(__dirname, 'animation-frames', CONFIG.TRAY_FRAME));

    // Resized to 32px and tagged scaleFactor 2, so a Retina menu bar gets real
    // pixels rather than a 16px bitmap upscaled to mush.
    const scaled = nativeImage.createFromBuffer(buffer).resize({ height: 32, quality: 'best' });
    const { width, height } = scaled.getSize();
    const bitmap = scaled.toBitmap(); // BGRA

    // Squeezing painted art down from 1004px leaves nearly every pixel only
    // partially opaque, and a template image draws purely from alpha — so it
    // rendered as a faint smudge. Push the partials towards solid.
    for (let i = 3; i < bitmap.length; i += 4) {
      if (bitmap[i] > 0) bitmap[i] = Math.min(255, Math.round(bitmap[i] * 2.2));
    }

    const icon = nativeImage.createFromBitmap(bitmap, { width, height, scaleFactor: 2 });
    // Template images use only the alpha channel, so the painted colour is
    // ignored and the silhouette adapts to light and dark menu bars.
    icon.setTemplateImage(true);
    return icon;
  } catch (error) {
    console.warn('Could not build tray icon:', error.message);
    return nativeImage.createEmpty();
  }
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Name Picker');
  refreshTrayMenu();
}

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
  if (!win || win.isDestroyed()) return;
  // Rolling while hidden would be a dead hotkey — bring it back first.
  if (action === 'roll' && !win.isVisible()) setWidgetVisible(true);
  win.webContents.send('hotkey', action);
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
  createTray();
  registerHotkeys();

  console.log(`ux-hub-dice ready — ${CONFIG.HOTKEYS.roll} to pick, ` +
    `${CONFIG.HOTKEYS.dismiss} to dismiss, ${CONFIG.HOTKEYS.quit} to quit.`);
});

app.on('before-quit', savePosition);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
