const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  // Toggle whether the invisible window swallows clicks. Called as the cursor
  // enters and leaves the buttons.
  setInteractive: (interactive) => ipcRenderer.send('set-interactive', !!interactive),

  // Drag to reposition. The renderer decides when a press has become a drag;
  // main does the actual moving.
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),

  // Ask main to pop its native menu at the cursor.
  showMenu: () => ipcRenderer.send('show-context-menu'),

  onHotkey: (callback) => {
    ipcRenderer.on('hotkey', (_event, action) => callback(action));
  },

  // The checked names, and every later change to them.
  getNames: () => ipcRenderer.invoke('roster:active'),
  onRoster: (callback) => {
    ipcRenderer.on('roster', (_event, names) => callback(names));
  },

  // Fired once the native menu is dismissed. The renderer sees no mouseup or
  // mouseleave while a menu is tracking, so it needs telling.
  onMenuClosed: (callback) => {
    ipcRenderer.on('menu-closed', () => callback());
  },
});
