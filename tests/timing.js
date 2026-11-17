const fs = require('fs'); const D = __dirname + '/out/' + '';
// Anschläge in einer 16-Bit-WAV finden: Zeitpunkte, an denen der Pegel nach Ruhe sprunghaft steigt
function onsets(file) {
  const b = fs.readFileSync(file); let o = 12, sr = 44100, ch = 2, data = null;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); } if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  // Hüllkurve in 2-ms-Fenstern; Anschlag = Pegel springt gegenüber 20 ms davor auf das Dreifache (mit 90 ms Sperrzeit)
  const N = data.length / 2 / ch, W = Math.round(sr * .002), env = [], out = [];
  for (let i = 0; i + W <= N; i += W) { let m = 0; for (let j = i; j < i + W; j++) m = Math.max(m, Math.abs(data.readInt16LE(j * 2 * ch)) / 32768); env.push(m); }
  let block = 0;
  for (let k = 0; k < env.length; k++) { const before = k >= 10 ? Math.max(env[k - 10], env[k - 9], env[k - 8]) : 0; if (k >= block && env[k] > .06 && env[k] > before * 3) { let j = k; while (j > 0 && env[j - 1] > .01 && env[j - 1] < env[j]) j--; out.push(j * W / sr); block = k + 45; } }
  return out;
}
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const exp = async name => { await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav16'); await p.locator('#xNorm').selectOption('off'); const dl = p.waitForEvent('download', { timeout: 60000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + name); await p.waitForTimeout(400); return onsets(D + name); };
  const report = (label, got, want) => { const err = want.map((w, i) => got[i] == null ? null : (got[i] - w) * 1000); const max = Math.max(...err.map(e => e == null ? 999 : Math.abs(e))); console.log(`${label}: ${got.length} Anschläge (erwartet ${want.length}), größte Abweichung ${max.toFixed(2)} ms${got.length !== want.length || max > 3 ? '  ← AUFFÄLLIG: ' + got.slice(0, 20).map(x => x.toFixed(3)).join(' ') : ''}`); };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.fill('#bpm', '120'); await p.keyboard.press('Enter');
  const hw = await p.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right), lane = await p.locator('.lane[data-track]').first().boundingBox();
  await p.mouse.dblclick(hw + 10, lane.y + 30); await p.waitForTimeout(400);
  await p.locator('#patsel').selectOption('Leer'); await p.waitForTimeout(300);
  for (const k of [0, 4, 8, 12]) await p.locator(`.cell[data-d="kick"][data-k="${k}"]`).click();
  let P = await proj(); console.log('Pattern: Region', P.tracks[0].regions[0].start, '+', P.tracks[0].regions[0].len, 'Kicks', P.tracks[0].regions[0].steps.kick.map(v => v ? 'X' : '.').join(''));
  const beat = .5;
  report('4/4, 120 BPM, 4 Takte', await exp('t1.wav'), Array.from({ length: 16 }, (_, i) => i * beat));
  // Region teilen (Schnitt mitten im Takt) und hinteren Teil verschieben: Phase des Patterns muss stimmen
  const r = await p.locator('#ruler').boundingBox(); await p.mouse.click(r.x + 5 * 30 + 1, r.y + 20);   // Beat 5
  await p.locator('.region').first().click({ position: { x: 10, y: 30 } }); await p.keyboard.press('b'); await p.waitForTimeout(200);
  report('nach Teilen bei Schlag 6 (unverändert)', await exp('t2.wav'), Array.from({ length: 16 }, (_, i) => i * beat));
  // Taktartwechsel auf 3/4 ab Takt 3: weiter jeder Schlag ein Kick, lückenlos
  await p.keyboard.press('Control+z');
  await p.mouse.click(r.x + 8 * 30 + 4, r.y + 20, { button: 'right' }); await p.locator('#ctxMenu .cx-chips button', { hasText: '3/4' }).click(); await p.waitForTimeout(300);
  P = await proj(); console.log('  Regionen nach Wechsel:', P.tracks[0].regions.map(x => `${x.start}+${x.len} ${x.sig.join('/')}`).join(' | '));
  const n = P.tracks[0].regions.reduce((a, x) => Math.max(a, x.start + x.len), 0);
  report('mit Wechsel auf 3/4 ab Takt 3', await exp('t3.wav'), Array.from({ length: n }, (_, i) => i * beat));
  // Swing und andere Tempi prüft swing.js auf das Sample genau (der Anschlagsdetektor hier ist für überlappende Kicks zu grob)
};
