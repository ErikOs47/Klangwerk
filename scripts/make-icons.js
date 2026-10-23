// Rendert die App-Icons aus src/brand/logo.svg (braucht Playwright mit Chromium: npx playwright).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/brand');
const logo = fs.readFileSync(path.join(out, 'logo.svg'), 'utf8');
// [Datei, Kantenlänge, Rundung (Anteil), Logo-Anteil, transparent außen]
const icons = [
  ['icon-512.png', 512, .22, .84, true],
  ['icon-256.png', 256, .22, .84, true],
  ['icon-192.png', 192, .22, .84, true],
  ['apple-touch-icon.png', 180, 0, .84, false],
  ['icon-maskable-512.png', 512, 0, .66, false]
];
(async () => {
  const b = await chromium.launch();
  for (const [file, n, r, k, transparent] of icons) {
    const p = await b.newPage({ viewport: { width: n, height: n } });
    await p.setContent(`<body style="margin:0;background:transparent"><div style="width:${n}px;height:${n}px;border-radius:${n * r}px;background:#15171c;display:grid;place-items:center">${logo.replace('<svg ', `<svg width="${n * k}" height="${n * k}" `)}</div></body>`);
    await p.screenshot({ path: path.join(out, file), omitBackground: transparent });
    await p.close();
  }
  await b.close();
  console.log('Icons geschrieben');
})();
