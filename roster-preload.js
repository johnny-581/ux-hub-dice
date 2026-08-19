const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roster', {
  // The full list, entries as { name, enabled }.
  get: () => ipcRenderer.invoke('roster:get'),

  // Returns 'ok' | 'empty' | 'duplicate', so the editor can say why nothing
  // happened rather than just ignoring you.
  add: (name) => ipcRenderer.invoke('roster:add', name),

  remove: (name) => ipcRenderer.send('roster:remove', name),
  toggle: (name) => ipcRenderer.send('roster:toggle', name),

  // Main is the source of truth: every change comes back through here, including
  // the ones made from the menus while this window is open.
  onChange: (callback) => {
    ipcRenderer.on('roster', (_event, entries) => callback(entries));
  },
});
