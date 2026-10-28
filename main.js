// Electron-Hauptprozess: öffnet Sound Groot als Windows-Programm, mit Startfenster während des Ladens.
const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path'), fs = require('fs');

// Projekte und Einstellungen bleiben im bisherigen Ordner (aus der Zeit als „Klangwerk“), damit nach dem Umbenennen nichts verloren geht.
app.setPath('userData', path.join(app.getPath('appData'), 'Klangwerk'));

const icon = path.join(__dirname, 'dist', 'brand', 'icon-256.png');

function createWindow() {
  const splash = new BrowserWindow({
    width: 640, height: 400, frame: false, resizable: false, movable: true, transparent: true,
    alwaysOnTop: true, skipTaskbar: false, show: false, icon, title: 'Sound Groot'
  });
  splash.loadFile(path.join(__dirname, 'dist', 'splash.html'), { query: { v: app.getVersion() } });
  splash.once('ready-to-show', () => splash.show());
  const t0 = Date.now();

  const win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 900, minHeight: 600, show: false, icon,
    backgroundColor: '#0f1014', title: 'Sound Groot', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  // Mindestens 1,6 s Startfenster, damit es nicht nur aufblitzt
  win.once('ready-to-show', () => setTimeout(() => {
    win.show();
    if (!splash.isDestroyed()) splash.destroy();
  }, Math.max(0, 1600 - (Date.now() - t0))));
}

// Sample-Ordner lesen (für den Datei-Browser der Bibliothek). Nur lesen, nie schreiben.
// MPC Beats / MPC-Software legen installierte Expansions unter ProgramData\Akai ab (laut Akai-Support).
function mpcRoots() {
  const pd = process.env.ProgramData || 'C:\\ProgramData', docs = app.getPath('documents');
  return [
    ['MPC-Expansions', path.join(pd, 'Akai', 'MPC', 'Expansions')],
    ['MPC 3 Expansions', path.join(pd, 'Akai', 'MPC 3', 'Expansions')],
    ['MPC-Inhalte', path.join(pd, 'Akai', 'MPC', 'Content')],
    ['MPC (Dokumente)', path.join(docs, 'MPC')],
    ['MPC Beats (Dokumente)', path.join(docs, 'MPC Beats')]
  ].filter(([, p]) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }).map(([name, p]) => ({ name, path: p }));
}
ipcMain.handle('sgfs:roots', () => mpcRoots());
ipcMain.handle('sgfs:list', async (e, dir) => (await fs.promises.readdir(dir, { withFileTypes: true }))
  .map(d => ({ name: d.name, path: path.join(dir, d.name), dir: d.isDirectory() })));
ipcMain.handle('sgfs:read', (e, file) => fs.promises.readFile(file));
ipcMain.handle('sgfs:pick', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Sample-Ordner wählen', properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

app.whenReady().then(() => {
  // Mikrofon und MIDI-Geräte ohne Rückfrage erlauben, es ist eine lokale App.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'midi', 'midiSysex'].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ['media', 'midi', 'midiSysex'].includes(perm));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
