// Brücke zwischen der App und dem Dateisystem (nur in der Windows-App): Sample-Ordner und MPC-Bibliothek lesen.
// Die App selbst bekommt keinen Node-Zugriff, nur diese Funktionen.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sgfs', {
  roots: () => ipcRenderer.invoke('sgfs:roots'),
  list: dir => ipcRenderer.invoke('sgfs:list', dir),
  read: file => ipcRenderer.invoke('sgfs:read', file),
  pick: () => ipcRenderer.invoke('sgfs:pick')
});
// VST3-Plugins (nur Windows): suchen, in eigenem Prozess starten, steuern. Der Klang läuft per WebSocket direkt zum Plugin.
contextBridge.exposeInMainWorld('sgvst', {
  available: () => ipcRenderer.invoke('vst:available'),
  list: force => ipcRenderer.invoke('vst:list', force),
  addDir: () => ipcRenderer.invoke('vst:addDir'),
  removeDir: dir => ipcRenderer.invoke('vst:removeDir', dir),
  open: o => ipcRenderer.invoke('vst:open', o),
  cmd: (id, cmd, arg) => ipcRenderer.invoke('vst:cmd', id, cmd, arg),
  close: id => ipcRenderer.invoke('vst:close', id),
  onEvent: fn => { ipcRenderer.on('vst:event', (e, id, msg) => fn(id, msg)); },
  onExit: fn => { ipcRenderer.on('vst:exit', (e, id, code) => fn(id, code)); },
  onProgress: fn => { ipcRenderer.on('vst:progress', (e, p) => fn(p)); }
});
