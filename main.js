// Electron-Hauptprozess: öffnet Klangwerk als Windows-Programm.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 900, minHeight: 600,
    backgroundColor: '#16171b', title: 'Klangwerk', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  // Mikrofon und MIDI-Geräte ohne Rückfrage erlauben, es ist eine lokale App.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'midi', 'midiSysex'].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ['media', 'midi', 'midiSysex'].includes(perm));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
