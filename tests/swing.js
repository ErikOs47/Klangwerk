const fs = require('fs'); const D = __dirname + '/out/' + '';
function wav(file) {
  const b = fs.readFileSync(file); let o = 12, ch = 2, data = null;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') ch = b.readUInt16LE(o + 10); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  const N = data.length / 4 / ch, x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = data.readFloatLE(i * 4 * ch); return x;
}
const first = x => x.findIndex(v => Math.abs(v) > 1e-4);
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const exp = async name => { await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav32'); await p.locator('#xNorm').selectOption('off'); const dl = p.waitForEvent('download', { timeout: 60000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + name); await p.waitForTimeout(400); return wav(D + name); };
  const load = async P => { fs.writeFileSync(D + 'ld.soundgroot.json', JSON.stringify({ format: 'klangwerk', project: P, audio: {} })); await p.locator('#projIn').setInputFiles(D + 'ld.soundgroot.json'); await p.waitForTimeout(1200); const Q = await proj(); if (JSON.stringify(Q.tracks.map(t => [t.out, t.mute, t.regions[0]?.swing])) !== JSON.stringify(P.tracks.map(t => [t.out, t.mute, t.regions[0]?.swing])) || Q.bpm !== P.bpm) console.log('  !! Laden hat nicht gegriffen'); };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.fill('#bpm', '120'); await p.keyboard.press('Enter');
  const hw = await p.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right), lane = await p.locator('.lane[data-track]').first().boundingBox();
  await p.mouse.dblclick(hw + 10, lane.y + 30); await p.waitForTimeout(400);
  await p.locator('#patsel').selectOption('Leer'); await p.waitForTimeout(300);
  await p.locator(`.cell[data-d="kick"][data-k="1"]`).click();
  let P = await proj();
  for (const [sw, bpm, hum] of [[50, 120, 0], [66, 120, 0], [75, 120, 0], [66, 90, 0], [60, 173, 0]]) {
    const Q = JSON.parse(JSON.stringify(P)); Q.bpm = bpm; Q.tracks[0].regions[0].swing = sw; await load(Q);
    const x = await exp('sw.wav'), want = (.25 + (sw - 50) / 50 * .25) * 60 / bpm * 44100;
    console.log(`Swing ${sw} %, ${bpm} BPM: erster Ton bei Sample ${first(x)}, erwartet ${want.toFixed(1)} → Abweichung ${(first(x) - want).toFixed(1)} Samples`);
  }
};
