// Baut aus src/app.html eine eigenständige index.html (für Electron und den Browser).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const body = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style></head><body>\n${body}\n</body></html>\n`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
fs.cpSync(path.join(root, 'src/vendor'), path.join(root, 'dist/vendor'), { recursive: true });
console.log('dist/index.html geschrieben');
