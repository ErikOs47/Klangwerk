const fs = require('fs'); const D = __dirname + '/out/' + '';
function wav(file) { const b = fs.readFileSync(file); let o = 12, ch = 2, data = null; while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') ch = b.readUInt16LE(o + 10); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); } const N = data.length / 4 / ch, x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = data.readFloatLE(i * 4 * ch); return x; }
const peak = (x, a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i])); return m; };
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const exp = async name => { await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav32'); await p.locator('#xNorm').selectOption('off'); const dl = p.waitForEvent('download', { timeout: 60000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + name); await p.waitForTimeout(400); return wav(D + name); };
  const load = async P => { fs.writeFileSync(D + 'ld.soundgroot.json', JSON.stringify({ format: 'klangwerk', project: P, audio: {} })); await p.locator('#projIn').setInputFiles(D + 'ld.soundgroot.json'); await p.waitForTimeout(1200); };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.fill('#bpm', '120'); await p.keyboard.press('Enter');
  const hw = await p.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right), lane = await p.locator('.lane[data-track]').first().boundingBox();
  await p.mouse.dblclick(hw + 10, lane.y + 30); await p.waitForTimeout(400);
  await p.locator('#patsel').selectOption('Leer'); await p.waitForTimeout(300);
  for (const k of [0, 4, 8, 12]) await p.locator(`.cell[data-d="kick"][data-k="${k}"]`).click();
  const P = await proj(); const g = { id: 'g1', name: 'Gruppe 1', color: '#888', vol: Math.sqrt(1 / 1.2), pan: 0, mute: false, solo: false, glue: false };
  const mk = (grp, m0, m1, two = true, s0 = false, s1 = false) => { const Q = JSON.parse(JSON.stringify(P)); if (grp) { Q.groups = [g]; Q.tracks[0].out = 'g1'; } Q.tracks[0].mute = m0; Q.tracks[0].solo = s0; if (two) { const t2 = JSON.parse(JSON.stringify(P.tracks[0])); t2.id = 't2x'; t2.name = 'Zweite'; t2.regions.forEach((r, i) => r.id = 'r2x' + i); t2.mute = m1; t2.solo = s1; Q.tracks.push(t2); } return Q; };
  for (const [label, Q] of [['eine Spur', mk(0, 0, 0, false)], ['zwei Spuren', mk(0, false, false)], ['zweite stumm', mk(0, false, true)], ['erste stumm', mk(0, true, false)], ['beide stumm', mk(0, true, true)], ['erste solo', mk(0, false, false, true, true)],
    ['Gruppe: zwei Spuren', mk(1, false, false)], ['Gruppe: zweite stumm', mk(1, false, true)], ['Gruppe: erste stumm', mk(1, true, false)], ['Gruppe: erste solo', mk(1, false, false, true, true)], ['Gruppe: zweite solo', mk(1, false, false, true, false, true)]]) {
    await load(Q); const st = await proj(); const x = await exp('m.wav');
    console.log(label.padEnd(22), 'Pegel', peak(x, 300, 4000).toFixed(3), '| Zustand:', st.tracks.map(t => `${t.name}${t.mute ? ' M' : ''}${t.solo ? ' S' : ''}${t.out ? ' →G' : ''}`).join(', '));
  }
};
