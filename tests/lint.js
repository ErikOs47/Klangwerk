// Lint der App: zieht das große <script> aus src/app.html (Zeilennummern bleiben gleich) und prüft es mit eslint.
// Einmalig: npm i --no-save eslint@9 globals   ·   Aufruf: node tests/lint.js
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
const s = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
const m = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0];
fs.writeFileSync(path.join(out, 'app.js'), '\n'.repeat(s.slice(0, m.index).split('\n').length - 1) + m[1]);
fs.copyFileSync(path.join(root, 'src/sw.js'), path.join(out, 'sw.js'));
fs.copyFileSync(path.join(root, 'main.js'), path.join(out, 'main.cjs'));
fs.copyFileSync(path.join(root, 'preload.js'), path.join(out, 'preload.cjs'));
fs.copyFileSync(path.join(root, 'src/plugins/sg/core.js'), path.join(out, 'core.mjs'));
try { execSync(`npx eslint -c ${path.join(__dirname, 'eslint.config.js')} app.js sw.js main.cjs preload.cjs core.mjs`, { cwd: out, stdio: 'inherit' }); }
catch (e) { process.exit(1); }
