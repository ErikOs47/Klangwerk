// Klänge prüfen: jedes Instrument / Kit einzeln rendern, Lautheit (LUFS), Spitze, Stille und Anschlagstufen messen.
// Aufruf: node t.js 1440 900 - sounds.js   (Liste per Umgebungsvariable SG_SOUNDS="s_hq-piano,s_piano kit:s_hqjazz" änderbar)
const fs = require('fs'); const D = __dirname + '/out/';
function wav(file) {
  const b = fs.readFileSync(file); let o = 12, ch = 2, data = null;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') ch = b.readUInt16LE(o + 10); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  const N = data.length / 4 / ch, L = new Float32Array(N), R = new Float32Array(N); for (let i = 0; i < N; i++) { L[i] = data.readFloatLE(i * 4 * ch); R[i] = data.readFloatLE(i * 4 * ch + (ch > 1 ? 4 : 0)); } return { L, R };
}
const lufs = f => require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-']).stderr.toString().split('Summary:').pop();
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(300); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const load = async P => { fs.writeFileSync(D + 'snd.soundgroot.json', JSON.stringify({ format: 'klangwerk', project: P, audio: {} })); await p.locator('#projIn').setInputFiles(D + 'snd.soundgroot.json'); await p.waitForTimeout(900); };
  const exp = async name => { await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav32'); await p.locator('#xNorm').selectOption('off'); const dl = p.waitForEvent('download', { timeout: 120000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + name); await p.waitForTimeout(300); return D + name; };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  const base = await proj();
  const list = (process.env.SG_SOUNDS || 's_hq-piano s_piano s_grand-steinway kit:s_hqjazz kit:s_vcsl kit:acoustic').split(/[ ,]+/).filter(Boolean);
  const rms = (x, a, b) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / Math.max(1, b - a)); };
  for (const id of list) {
    const P = JSON.parse(JSON.stringify(base)); P.bpm = 120; P.tempos = undefined; P.loop = { on: false, start: 0, end: 16 };
    const kit = id.startsWith('kit:');
    if (kit) {
      // Takt 1–2: alle Instrumente nacheinander leise (0,3) / Takt 3–4: laut (1,0); Takt 5: schnelle 16tel-Hi-Hats (Varianten)
      const t = P.tracks.find(t => t.type === 'drums'); t.kit = id.slice(4); t.vol = Math.sqrt(1 / 1.2);
      const ids = ['kick', 'snare', 'clap', 'hat', 'ohat', 'tom', 'rim', 'cow', 'crash', 'ride', 'shaker', 'conga'];
      const blank = () => Object.fromEntries(ids.map(e => [e, Array(16).fill(0)])), reg = (id, name, start, steps) => ({ id, name, start, len: 4, steps, pitch: blank(), trip: [false, false, false, false], sig: [4, 4], pb: 1, v2: true });
      // Jedes Instrument einmal leise (0,3) und einmal laut (1,0), je ein Takt Abstand; danach ein Takt 16tel-Hi-Hats (Varianten)
      t.regions = [];
      ids.forEach(d => { for (const v of [.3, 1]) { const st = blank(); st[d][0] = v; t.regions.push(reg('r' + d + (v < 1 ? 'p' : 'f'), d, t.regions.length * 4, st)); } });
      const h16 = blank(); h16.hat = Array(16).fill(.9); t.regions.push(reg('rhh', 'hh', t.regions.length * 4, h16));
      P.tracks = [t];
      await load(P);
      const f = await exp('kit.wav'), w = wav(f), sr = 44100, out = [];
      t.regions.filter(x => x.id !== 'rhh').forEach((x, i) => { const a = Math.round(x.start * .5 * sr), b = a + sr; out.push(`${x.name}${x.id.endsWith('p') ? '·p' : '·f'} ${(20 * Math.log10(rms(w.L, a, b) + 1e-9)).toFixed(0)}`); });
      // Hi-Hat-16tel: unterscheiden sich die Schläge? (Varianten)
      const a0 = Math.round(t.regions.at(-1).start * .5 * sr), seg = Math.round(.125 * sr), hh = Array.from({ length: 8 }, (_, k) => w.L.subarray(a0 + k * seg, a0 + k * seg + 2000));
      let diff = 0; for (let k = 1; k < 8; k++) { let d = 0, e = 0; for (let i = 0; i < 2000; i++) { d += (hh[k][i] - hh[0][i]) ** 2; e += hh[0][i] ** 2; } diff = Math.max(diff, d / (e || 1)); }
      const L = lufs(f).match(/I:\s+(-?[\d.]+) LUFS/)?.[1], pk = Math.max(...[w.L, w.R].map(x => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
      let st2 = 0; for (let i = 0; i < w.L.length; i++) st2 += (w.L[i] - w.R[i]) ** 2;
      console.log(`${id.padEnd(22)} ${L} LUFS, Spitze ${(20 * Math.log10(pk)).toFixed(1)} dBFS, Stereo ${st2 > 1 ? 'ja' : 'nein'}, Hi-Hat-Varianten ${diff > .01 ? 'ja' : 'nein'} (${diff.toFixed(3)})`);
      console.log('   dB je Schlag (p = leise, f = laut):', out.join(' | '));
      continue;
    }
    const t = P.tracks.find(t => t.type === 'synth'); t.preset = id; t.vol = Math.sqrt(1 / 1.2); delete t.wam; t.ins = [];
    // Tonleiter über 5 Oktaven: jede Note bei Velocity 0,25 / 0,55 / 0,95
    const notes = []; let s = 0; for (const m of [36, 48, 60, 72, 84]) for (const v of [.25, .55, .95]) { notes.push({ p: m, s, l: 1.5, v }); s += 2; }
    t.regions = [{ id: 'rn', name: 'n', start: 0, len: s + 4, notes }]; P.tracks = [t];
    await load(P);
    const f = await exp('inst.wav'), w = wav(f), sr = 44100;
    const L = lufs(f).match(/I:\s+(-?[\d.]+) LUFS/)?.[1], pk = Math.max(...[w.L, w.R].map(x => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
    const lv = notes.map(n => { const a = Math.round(n.s * .5 * sr); return 20 * Math.log10(rms(w.L, a, a + Math.round(.5 * sr)) + 1e-9); });
    let st2 = 0, e2 = 0; for (let i = 0; i < w.L.length; i++) { st2 += (w.L[i] - w.R[i]) ** 2; e2 += w.L[i] ** 2; }
    const silent = lv.filter(v => v < -60).length;
    console.log(`${id.padEnd(22)} ${L} LUFS, Spitze ${(20 * Math.log10(pk)).toFixed(1)} dBFS, Stereo ${st2 / (e2 || 1) > .01 ? 'ja' : 'nein'}, stumme Töne ${silent}`);
    console.log('   dB je Ton (C2 C3 C4 C5 C6, je leise/mittel/laut):', [0, 3, 6, 9, 12].map(i => lv.slice(i, i + 3).map(v => v.toFixed(0)).join('/')).join('  '));
  }
};
