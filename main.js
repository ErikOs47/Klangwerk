// Electron-Hauptprozess: öffnet Sound Groot als Windows-Programm, mit Startfenster während des Ladens.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

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
    webPreferences: { contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  // Mindestens 1,6 s Startfenster, damit es nicht nur aufblitzt
  win.once('ready-to-show', () => setTimeout(() => {
    win.show();
    if (!splash.isDestroyed()) splash.destroy();
  }, Math.max(0, 1600 - (Date.now() - t0))));
}

app.whenReady().then(() => {
  // Mikrofon und MIDI-Geräte ohne Rückfrage erlauben, es ist eine lokale App.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'midi', 'midiSysex'].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ['media', 'midi', 'midiSysex'].includes(perm));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
