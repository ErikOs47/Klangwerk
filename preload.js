// Brücke zwischen der App und dem Dateisystem (nur in der Windows-App): Sample-Ordner und MPC-Bibliothek lesen.
// Die App selbst bekommt keinen Node-Zugriff, nur diese vier Funktionen.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sgfs', {
  roots: () => ipcRenderer.invoke('sgfs:roots'),
  list: dir => ipcRenderer.invoke('sgfs:list', dir),
  read: file => ipcRenderer.invoke('sgfs:read', file),
  pick: () => ipcRenderer.invoke('sgfs:pick')
});
