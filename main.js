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

// ================= VST3-Plugins (nur Windows) =================
// Jedes Plugin läuft in einem eigenen Prozess (sg-vst3host.exe, Quelle in native/vst3host). Stürzt ein Plugin ab,
// endet nur dieser Prozess, Sound Groot läuft weiter. Der Host meldet sich mit einer JSON-Zeile, danach gilt:
// Steuerung zeilenweise über stdin/stdout, Audio direkt zwischen App und Host über einen lokalen WebSocket.
const { spawn } = require('child_process'), crypto = require('crypto');
const vstExe = app.isPackaged ? path.join(process.resourcesPath, 'sg-vst3host.exe') : path.join(__dirname, 'native', 'bin', 'sg-vst3host.exe');
// Nur für Tests unter Linux: SG_VST_WINE=1 startet den Host mit Wine, SG_VST_DIRS nennt die Plugin-Ordner
const vstWine = process.platform !== 'win32' && !!process.env.SG_VST_WINE;
const vstOk = () => (process.platform === 'win32' || vstWine) && fs.existsSync(vstExe);
const vstSpawn = args => vstWine ? spawn('wine', [vstExe, ...args]) : spawn(vstExe, args, { windowsHide: true });
const hostPath = p => vstWine ? 'Z:' + p.replace(/\//g, '\\') : p;
const vstCfgFile = () => path.join(app.getPath('userData'), 'vst3.json');
let vstCfg = null;
function vstConf() {
  if (!vstCfg) { try { vstCfg = JSON.parse(fs.readFileSync(vstCfgFile(), 'utf8')); } catch (e) { vstCfg = {}; } }
  vstCfg.dirs ||= []; vstCfg.cache ||= {};
  return vstCfg;
}
const vstSave = () => fs.promises.writeFile(vstCfgFile(), JSON.stringify(vstCfg)).catch(() => { });
// Standard-Orte laut Steinberg: Common Files\VST3 (alle Benutzer) und %LOCALAPPDATA%\Programs\Common\VST3 (nur ich)
function vstDirs() {
  const std = process.platform === 'win32'
    ? [path.join(process.env.CommonProgramFiles || 'C:\\Program Files\\Common Files', 'VST3'), path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Common', 'VST3')]
    : (process.env.SG_VST_DIRS || '').split(':').filter(Boolean);
  return [...new Set([...std, ...vstConf().dirs])];
}
// Alle .vst3 unterhalb eines Ordners. Ein .vst3-Ordner ist ein Bundle (ein Plugin), in den wird nicht weiter geschaut.
// Nebenbei werden .dll gezählt: das sind meist VST2-Plugins, die Sound Groot nicht lädt (Hinweis in der App).
async function vstFind(dir, depth = 0, out = [], dll = { n: 0 }) {
  let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { out.missing = depth === 0; return out; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (/\.vst3$/i.test(d.name)) out.push(p);
    else if (/\.dll$/i.test(d.name)) dll.n++;
    else if (d.isDirectory() && depth < 6) await vstFind(p, depth + 1, out, dll);
  }
  if (depth === 0) out.dll = dll.n;
  return out;
}
function vstScanOne(file) {
  return new Promise(res => {
    const p = vstSpawn(['--scan', hostPath(file)]), cls = []; let buf = '', err = '';
    const t = setTimeout(() => { err = 'Zeitüberschreitung beim Laden'; p.kill(); }, 30000);
    p.stdout.on('data', d => { buf += d; });
    p.on('error', e => { err = e.message; });
    p.on('close', code => {
      clearTimeout(t);
      for (const l of buf.split('\n')) { try { const j = JSON.parse(l); if (j.error) err = j.error; else if (j.cid) cls.push(j); } catch (e) { } }
      res(cls.length ? { classes: cls } : { error: err || (code ? `Plugin ist beim Laden abgestürzt (Code ${code})` : 'Keine Klangklasse gefunden') });
    });
  });
}
// Ergebnis pro Datei wird gemerkt (nach Änderungsdatum), damit nur neue oder geänderte Plugins geladen werden müssen
async function vstScan(wc, force) {
  const cfg = vstConf(), files = [], dirInfo = [];
  for (const d of vstDirs()) { const f = await vstFind(d); files.push(...f); dirInfo.push({ dir: d, vst3: f.length, dll: f.dll || 0, missing: !!f.missing }); }
  const todo = [];
  for (const f of files) {
    let m = 0; try { m = (await fs.promises.stat(f)).mtimeMs; } catch (e) { }
    if (force || !cfg.cache[f] || cfg.cache[f].mtime !== m) todo.push([f, m]);
  }
  let done = 0;
  const worker = async () => {
    for (let job; (job = todo.shift());) {
      const [f, m] = job;
      if (!wc.isDestroyed()) wc.send('vst:progress', { done, total: done + todo.length + 1, name: path.basename(f) });
      cfg.cache[f] = { mtime: m, ...await vstScanOne(f) }; done++;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  for (const f of Object.keys(cfg.cache)) if (!files.includes(f)) delete cfg.cache[f];
  if (done) await vstSave();
  const plugs = [], failed = [];
  for (const f of files) {
    const c = cfg.cache[f]; if (!c) continue;
    if (c.error) failed.push({ path: f, error: c.error });
    else for (const k of c.classes) plugs.push({ ...k, path: f });
  }
  plugs.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return { plugs, failed, dirs: vstDirs(), own: cfg.dirs, dirInfo };
}
const vstHosts = new Map();
let vstNext = 1;
function vstKill(h) {
  if (h.dead) return; h.dead = true;
  try { h.p.stdin.write('0 quit\n'); h.p.stdin.end(); } catch (e) { }
  setTimeout(() => { try { h.p.kill(); } catch (e) { } }, 3000);
}
function vstOpen(wc, { path: file, cid, sr, title }) {
  if (!vstOk()) return Promise.reject(new Error('VST3 ist nur in der Windows-App verfügbar'));
  if (!/\.vst3$/i.test(file || '') || !/^[0-9A-F]{32}$/i.test(cid || '')) return Promise.reject(new Error('Ungültiges Plugin'));
  if (!fs.existsSync(file)) return Promise.reject(new Error('Plugin ist auf diesem PC nicht installiert'));
  const token = crypto.randomBytes(16).toString('hex'), id = vstNext++;
  const p = vstSpawn(['--run', hostPath(file), '--cid', cid, '--sr', String(Math.round(sr)), '--token', token, '--title', String(title || 'Plugin')]);
  const h = { id, p, wc, pend: new Map(), n: 0, buf: '' };
  return new Promise((res, rej) => {
    const t = setTimeout(() => { rej(new Error('Plugin startet nicht (Zeitüberschreitung)')); vstKill(h); }, 30000);
    p.on('error', e => { clearTimeout(t); rej(e); });
    p.stdout.on('data', d => {
      h.buf += d; let i;
      while ((i = h.buf.indexOf('\n')) >= 0) {
        const l = h.buf.slice(0, i).replace(/\r$/, ''); h.buf = h.buf.slice(i + 1);
        if (!h.ready) {
          let j; try { j = JSON.parse(l); } catch (e) { continue; }
          clearTimeout(t); h.ready = true;
          if (j.error) { rej(new Error(j.error)); vstKill(h); return; }
          vstHosts.set(id, h); res({ ...j, id, token });
        } else if (l.startsWith('- ')) { if (!wc.isDestroyed()) wc.send('vst:event', id, l.slice(2)); }
        else {
          const [n, st, ...rest] = l.split(' '), cb = h.pend.get(+n);
          if (cb) { h.pend.delete(+n); st === 'ok' ? cb.res(rest.join(' ')) : cb.rej(new Error(rest.join(' ') || 'Fehler')); }
        }
      }
    });
    p.on('exit', code => {
      clearTimeout(t); vstHosts.delete(id);
      for (const cb of h.pend.values()) cb.rej(new Error('Plugin-Prozess beendet'));
      if (!h.ready) rej(new Error(`Plugin ist beim Laden abgestürzt (Code ${code})`));
      else if (!h.dead && !wc.isDestroyed()) wc.send('vst:exit', id, code);
    });
  });
}
function vstCmd(id, cmd, arg) {
  const h = vstHosts.get(id); if (!h || h.dead) return Promise.reject(new Error('Plugin läuft nicht'));
  return new Promise((res, rej) => {
    const n = ++h.n; h.pend.set(n, { res, rej });
    h.p.stdin.write(`${n} ${cmd}${arg != null ? ' ' + String(arg).replace(/[\r\n]/g, ' ') : ''}\n`);
  });
}
ipcMain.handle('vst:available', () => vstOk());
ipcMain.handle('vst:list', (e, force) => vstOk() ? vstScan(e.sender, !!force) : { plugs: [], failed: [], dirs: [], own: [] });
ipcMain.handle('vst:addDir', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Ordner mit VST3-Plugins wählen', properties: ['openDirectory'] });
  if (r.canceled) return null;
  const cfg = vstConf(); if (!cfg.dirs.includes(r.filePaths[0])) cfg.dirs.push(r.filePaths[0]);
  await vstSave(); return vstScan(e.sender, false);
});
ipcMain.handle('vst:removeDir', async (e, dir) => { const cfg = vstConf(); cfg.dirs = cfg.dirs.filter(d => d !== dir); await vstSave(); return vstScan(e.sender, false); });
ipcMain.handle('vst:open', (e, o) => vstOpen(e.sender, o || {}));
ipcMain.handle('vst:cmd', (e, id, cmd, arg) => vstCmd(id, cmd, arg));
ipcMain.handle('vst:close', (e, id) => { const h = vstHosts.get(id); if (h) { vstHosts.delete(id); vstKill(h); } });
// Neu laden oder Fenster zu: alle Plugin-Prozesse dieses Fensters beenden
function vstDropAll(wc) { for (const [id, h] of vstHosts) if (!wc || h.wc === wc) { vstHosts.delete(id); vstKill(h); } }
app.on('web-contents-created', (e, wc) => {
  wc.on('did-start-navigation', (ev, url, inPage, main) => { if (main && !inPage) vstDropAll(wc); });
  wc.on('render-process-gone', () => vstDropAll(wc));
  wc.on('destroyed', () => vstDropAll(wc));
});
app.on('will-quit', () => vstDropAll());

// CPU-Anzeige: Rechenlast des Fensters, in dem die Audio-Engine läuft (Prozent eines Kerns seit der letzten Abfrage)
ipcMain.handle('sys:cpu', e => {
  const pid = e.sender.getOSProcessId(), m = app.getAppMetrics().find(x => x.pid === pid);
  let vst = 0; for (const h of vstHosts.values()) if (h.wc === e.sender && !h.dead) vst++;
  return { renderer: m ? m.cpu.percentCPUUsage : 0, vst };
});

app.whenReady().then(() => {
  // Mikrofon und MIDI-Geräte ohne Rückfrage erlauben, es ist eine lokale App.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'midi', 'midiSysex'].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ['media', 'midi', 'midiSysex'].includes(perm));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
