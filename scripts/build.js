// Baut aus src/app.html eine eigenständige index.html (für Electron und den Browser)
// und dazu die Web-App-Dateien: manifest.webmanifest und sw.js (Offline-Modus).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const { version } = require(path.join(root, 'package.json'));
const body = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
const head = [
  '<meta charset="utf-8">',
  // maximum-scale verhindert, dass iOS beim Tippen in ein Eingabefeld hineinzoomt
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">',
  '<meta name="theme-color" content="#0f1014">',
  '<meta name="description" content="Sound Groot – eine DAW nach Logic-Vorbild">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="brand/apple-touch-icon.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Sound Groot">',
  '<style>body{margin:0;background:#0f1014}</style>'
].join('');
const html = `<!doctype html><html lang="de"><head>${head}</head><body>\n${body}\n</body></html>\n`;
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.cpSync(path.join(root, 'src/vendor'), path.join(dist, 'vendor'), { recursive: true });
fs.cpSync(path.join(root, 'src/samples'), path.join(dist, 'samples'), { recursive: true });
fs.cpSync(path.join(root, 'src/plugins'), path.join(dist, 'plugins'), { recursive: true });
fs.cpSync(path.join(root, 'src/brand'), path.join(dist, 'brand'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/splash.html'), path.join(dist, 'splash.html'));

// Web-App-Manifest: Name, Icons und Vollbild für „Zum Home-Bildschirm“
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({
  name: 'Sound Groot', short_name: 'Sound Groot', description: 'Eine DAW nach Logic-Vorbild: Spuren, Instrumente, Drums und Aufnahmen.',
  lang: 'de', start_url: './', scope: './', id: './', display: 'standalone', orientation: 'any',
  background_color: '#0f1014', theme_color: '#0f1014', categories: ['music', 'entertainment'],
  icons: [
    { src: 'brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));

// Service Worker: App-Hülle wird bei der Installation gespeichert, Sounds beim ersten Laden.
// Jeder Sound bekommt einen Hash, damit geänderte Dateien nach einem Update neu geladen werden.
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
const list = dir => fs.readdirSync(path.join(dist, dir)).filter(f => !f.startsWith('.')).map(f => dir + '/' + f);
const tree = dir => list(dir).flatMap(f => fs.statSync(path.join(dist, f)).isDirectory() ? tree(f) : [f]);
const shell = ['index.html', 'manifest.webmanifest', ...list('brand'), ...list('vendor')];
// Plugins (WAM) werden wie die Sounds beim ersten Laden gespeichert
const samples = Object.fromEntries([...list('samples').filter(f => f.endsWith('.js')), ...tree('plugins')].map(f => [f, hash(path.join(dist, f))]));
const sw = fs.readFileSync(path.join(root, 'src/sw.js'), 'utf8')
  .replace('__VERSION__', JSON.stringify(version + '-' + hash(path.join(dist, 'index.html'))))
  .replace('__SHELL__', JSON.stringify(shell))
  .replace('__SAMPLES__', JSON.stringify(samples));
fs.writeFileSync(path.join(dist, 'sw.js'), sw);
console.log('dist/index.html geschrieben (Web-App ' + version + ', ' + Object.keys(samples).length + ' Sound-Dateien)');
