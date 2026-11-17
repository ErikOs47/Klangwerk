const fs = require('fs'); const D = __dirname + '/out/' + '';
// 32-Bit-Float-WAV lesen (linker Kanal)
function wav(file) {
  const b = fs.readFileSync(file); let o = 12, ch = 2, data = null;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') ch = b.readUInt16LE(o + 10); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  const N = data.length / 4 / ch, x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = data.readFloatLE(i * 4 * ch); return x;
}
const first = x => x.findIndex(v => Math.abs(v) > 1e-4);
const peak = (x, a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i])); return m; };
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const exp = async name => { await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav32'); await p.locator('#xNorm').selectOption('off'); const dl = p.waitForEvent('download', { timeout: 60000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + name); await p.waitForTimeout(400); return wav(D + name); };
  const load = async P => { fs.writeFileSync(D + 'ld.soundgroot.json', JSON.stringify({ format: 'klangwerk', project: P, audio: {} })); await p.locator('#projIn').setInputFiles(D + 'ld.soundgroot.json'); await p.waitForTimeout(1200); const Q = await proj(); if (JSON.stringify(Q.tracks.map(t => [t.out, t.mute, t.regions[0]?.swing])) !== JSON.stringify(P.tracks.map(t => [t.out, t.mute, t.regions[0]?.swing])) || Q.bpm !== P.bpm) console.log('  !! Laden hat nicht gegriffen'); };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.fill('#bpm', '120'); await p.keyboard.press('Enter');
  const hw = await p.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right), lane = await p.locator('.lane[data-track]').first().boundingBox();
  await p.mouse.dblclick(hw + 10, lane.y + 30); await p.waitForTimeout(400);
  await p.locator('#patsel').selectOption('Leer'); await p.waitForTimeout(300);
  for (const k of [0, 4, 8, 12]) await p.locator(`.cell[data-d="kick"][data-k="${k}"]`).click();
  let P = await proj();
  const a = await exp('l1.wav'); const sr = 44100, i0 = first(a);
  console.log(`ohne Gruppe: erster Ton bei Sample ${i0} (${(i0 / sr * 1000).toFixed(2)} ms); Pegel 1. Schlag ${peak(a, 0, 4000).toFixed(3)}, 2. Schlag ${peak(a, 22050, 26050).toFixed(3)}, 3. ${peak(a, 44100, 48100).toFixed(3)}; Vorlauf-Rest (vor dem Ton) ${peak(a, 0, Math.max(1, i0)).toExponential(1)}`);
  // Spur in eine Gruppe legen
  const g = { id: 'g1', name: 'Gruppe 1', color: '#888', vol: Math.sqrt(1 / 1.2), pan: 0, mute: false, solo: false, glue: false };
  const P2 = JSON.parse(JSON.stringify(P)); P2.groups = [g]; P2.tracks[0].out = 'g1'; await load(P2);
  const b = await exp('l2.wav'); console.log(`in Gruppe: erster Ton bei Sample ${first(b)}; Pegel 1. Schlag ${peak(b, 0, 4000).toFixed(3)}, 2. ${peak(b, 22050, 26050).toFixed(3)}; Vorlauf-Rest ${peak(b, 0, Math.max(1, first(b))).toExponential(1)}`);
  // Zwei gleiche Spuren, eine in der Gruppe: je eine stumm, beide müssen auf demselben Sample beginnen
  const P3 = JSON.parse(JSON.stringify(P2)); const t2 = JSON.parse(JSON.stringify(P.tracks[0])); t2.id = 't2x'; t2.name = 'Zweite'; t2.regions.forEach((r, i) => r.id = 'r2x' + i); delete t2.out; P3.tracks.push(t2);
  P3.tracks[0].mute = true; await load(P3); const c = await exp('l3.wav');
  P3.tracks[0].mute = false; P3.tracks[1].mute = true; await load(P3); const d = await exp('l4.wav');
  console.log(`gemischt: Spur ohne Gruppe beginnt bei Sample ${first(c)}, Spur in Gruppe bei Sample ${first(d)} → Unterschied ${first(d) - first(c)} Samples`);
  let diff = 0; for (let i = 0; i < 20000; i++) diff = Math.max(diff, Math.abs(c[i] - d[i])); console.log('  größter Unterschied der beiden Wege (erste 20000 Samples):', diff.toExponential(2));
};
