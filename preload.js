const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  // Toggle whether the invisible window swallows clicks. Called as the cursor
  // enters and leaves the buttons.
  setInteractive: (interactive) => ipcRenderer.send('set-interactive', !!interactive),

  // Drag to reposition. The renderer decides when a press has become a drag;
  // main does the actual moving.
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),

  onHotkey: (callback) => {
    ipcRenderer.on('hotkey', (_event, action) => callback(action));
  },
});
