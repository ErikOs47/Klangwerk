// Hochwertige Instrumente und Drumkits (Sound Groot 1.8): Stereo, mehrere Anschlagstärken, bei Drums mehrere Varianten pro Schlag.
// Quellen (alle frei lizenziert, Einzelheiten in src/samples/QUELLE.txt):
//   sfzinstruments/SalamanderGrandPiano (CC-BY 3.0), sfzinstruments/virtuosity_drums (CC0), sgossner/VSCO-2-CE (CC0),
//   sfzinstruments/dsmolken.double-bass, karoryfer.* (CC0)
// Ausgabe: src/samples/hq-<id>.js bzw. src/samples/drums-hq<id>.js im Format 2:
//   Instrument: KW_SMP(id, { v: 2, z: [[midi, obereVelocity, base64Mp3], …] })   (gleiche midi+Velocity mehrfach = Varianten)
//   Drumkit:    KW_SMP('drums-'+id, { v: 2, p: { kick: [[obereVelocity, [base64Mp3, …]], …], … } })
// Die Pegel bleiben untereinander wie aufgenommen (ein gemeinsamer Faktor pro Instrument), damit leise Anschläge leise und weich klingen.
// Braucht git, ffmpeg, ffprobe. Aufruf: node scripts/fetch-hq.js [id …]   (ohne id: alles)
// Zwischenspeicher der Quell-Repos: $SG_HQ_CACHE oder <tmp>/sg-hq
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, execFile } = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/samples');
const cacheDir = process.env.SG_HQ_CACHE || path.join(os.tmpdir(), 'sg-hq'), SR = 44100;
fs.mkdirSync(cacheDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sghq-'));
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 1 << 30, encoding: 'buffer' }, (e, so, se) => e ? rej(new Error(String(se || e))) : res(so)));

// ---------------------------------------------------------------- Quell-Repos (nur die gebrauchten Dateien werden geladen)
const repos = new Map();
function repo(slug) {
  if (repos.has(slug)) return repos.get(slug);
  const dir = path.join(cacheDir, slug.replace('/', '__'));
  if (!fs.existsSync(path.join(dir, '.git'))) execFileSync('git', ['clone', '-q', '--filter=blob:none', '--no-checkout', '--depth', '1', `https://github.com/${slug}.git`, dir]);
  const files = execFileSync('git', ['-C', dir, 'ls-tree', '-r', '--name-only', 'HEAD'], { maxBuffer: 1 << 28 }).toString().split('\n').filter(Boolean);
  const r = { slug, dir, files, has: new Set(files) }; repos.set(slug, r); return r;
}
// Dateien auschecken (lädt die Inhalte nach), in Paketen
function need(r, list) {
  const miss = [...new Set(list)].filter(f => !fs.existsSync(path.join(r.dir, f)));
  for (let i = 0; i < miss.length; i += 40)
    for (let k = 0; ; k++) {
      try { execFileSync('git', ['-C', r.dir, 'checkout', '-q', 'HEAD', '--', ...miss.slice(i, i + 40)], { stdio: 'pipe' }); break; }
      catch (e) { if (k > 3) throw e; }
    }
}
// Datei dekodieren: Kanäle als Float32 (44,1 kHz), höchstens maxSec Sekunden
async function decode(r, f, maxSec) {
  const file = path.join(r.dir, f);
  const ch = +String(await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', file])).trim() || 1;
  const b = await run('ffmpeg', ['-v', 'error', '-i', file, '-t', String(maxSec + .5), '-ar', String(SR), '-f', 'f32le', '-']);
  const all = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)), n = all.length / ch;
  return Array.from({ length: ch }, (_, c) => { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = all[i * ch + c]; return d; });
}
// Mehrere Mikrofone (gleicher Schlag) zusammenmischen; mono wird auf beide Seiten gelegt
async function mix(parts, maxSec) {
  const dec = await Promise.all(parts.map(async p => ({ g: p.g ?? 1, pan: p.pan, d: await decode(p.r, p.f, maxSec) })));
  const stereo = dec.some(x => x.d.length > 1) || dec.length > 1, n = Math.max(...dec.map(x => x.d[0].length));
  const outc = Array.from({ length: stereo ? 2 : 1 }, () => new Float32Array(n));
  for (const x of dec) for (let c = 0; c < outc.length; c++) {
    const src = x.d[Math.min(c, x.d.length - 1)], pg = x.pan == null || x.d.length > 1 ? 1 : (c ? (1 + x.pan) / 2 : (1 - x.pan) / 2) * 1.414;
    for (let i = 0; i < src.length; i++) outc[c][i] += src[i] * x.g * pg;
  }
  return outc;
}
async function pool(items, n, fn) { const res = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); } })); return res; }

// ---------------------------------------------------------------- Aufbereitung
const peakOf = chs => { let p = 0; for (const d of chs) for (const v of d) p = Math.max(p, Math.abs(v)); return p; };
// Stille vorn weg (gemessen am lautesten Ton des Instruments), Länge begrenzen, ausblenden
function tidy(chs, ref, maxSec, fade) {
  const thr = ref * .004, L = chs[0].length;
  let s = 0; while (s < L && chs.every(d => Math.abs(d[s]) < thr)) s++;
  s = Math.max(0, s - 16);
  // hinten: wo das Signal unter -66 dB (vom Bezug) fällt, darf es aufhören
  let e = Math.min(L, s + Math.round(maxSec * SR)); const quiet = ref * 5e-4;
  while (e > s + SR * .2 && chs.every(d => Math.abs(d[e - 1]) < quiet)) e--;
  const nf = Math.min(e - s, Math.round(fade * SR));
  return chs.map(d => { const x = d.slice(s, e); for (let i = 0; i < nf; i++) x[x.length - nf + i] *= Math.cos(i / nf * Math.PI / 2); return x; });
}
// Stereo-Bild prüfen: fast gleiche Kanäle -> mono speichern (halbe Größe)
function monoIfSame(chs) {
  if (chs.length < 2) return chs;
  let d = 0, e = 0; for (let i = 0; i < chs[0].length; i++) { const a = chs[0][i], b = chs[1][i]; d += (a - b) * (a - b); e += a * a + b * b; }
  if (d < e * 1e-4) { const m = chs[0].map((v, i) => (v + chs[1][i]) / 2); return [m]; }
  return chs;
}
function mp3(chs, kbps) {
  const n = chs[0].length, C = chs.length, inter = new Float32Array(n * C);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) inter[i * C + c] = chs[c][i];
  const raw = path.join(tmp, 'o.f32'), enc = path.join(tmp, 'o.mp3');
  fs.writeFileSync(raw, Buffer.from(inter.buffer));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', String(C), '-i', raw, '-c:a', 'libmp3lame', '-b:a', (C > 1 ? kbps : Math.round(kbps * .6)) + 'k', enc]);
  return fs.readFileSync(enc).toString('base64');
}
// Grundton per Autokorrelation (für Quellen, deren Oktavzählung nicht einheitlich ist)
function pitchOf(d) {
  const a = Math.round(.1 * SR), N = Math.min(8192, d.length - a - 2400); if (N < 2048) return 0;
  const r = []; let mx = 0;
  for (let l = 18; l < 2300; l++) { let s = 0; for (let i = a; i < a + N; i++) s += d[i] * d[i + l]; r[l] = s; if (s > mx) mx = s; }
  for (let l = 19; l < 2299; l++) if (r[l] > .85 * mx && r[l] >= r[l - 1] && r[l] >= r[l + 1]) return 69 + 12 * Math.log2(SR / l / 440);
  return 0;
}
const NOTE = { c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11 };
// Notenname -> MIDI; c4 = 60 (wissenschaftlich) mit off = 0, „C3 = 60“-Zählung mit off = 12
const midiOf = (name, off = 0) => { const x = String(name).toLowerCase().match(/^([a-g](?:#|b)?)(-?\d)$/); return x ? 12 * (+x[2] + 1) + NOTE[x[1]] + off : null; };

// ---------------------------------------------------------------- Schreiben
function writeInst(id, zones, kbps, info) {
  const ref = Math.max(...zones.map(z => peakOf(z.chs)));
  const g = .97 / ref, z = [];
  for (const x of zones.sort((a, b) => a.m - b.m || a.v - b.v)) {
    const chs = monoIfSame(tidy(x.chs, ref, x.maxSec, x.fade ?? .25)).map(d => d.map(v => v * g));
    z.push([x.m, +x.v.toFixed(3), mp3(chs, kbps)]);
  }
  const file = path.join(out, id + '.js');
  fs.writeFileSync(file, `KW_SMP(${JSON.stringify(id)},${JSON.stringify({ v: 2, z })});\n`);
  console.log(`${id}: ${z.length} Töne, ${(fs.statSync(file).size / 1048576).toFixed(1)} MB  ${info || ''}`);
}
// Mischung eines Drumkits: Jedes Instrument wird beim lautesten Schlag auf einen üblichen Pegel relativ zur Kick gebracht
// (Raummikrofone eines echten Sets geben Snare und Becken sonst zu leise wieder). Die Abstufungen innerhalb bleiben, wie aufgenommen.
const MIXDB = { kick: -21, snare: -25, clap: -27, hat: -34, ohat: -30, tom: -24, rim: -33, cow: -33, crash: -29, ride: -31, shaker: -36, conga: -25 };
const rmsDb = chs => { const n = Math.min(chs[0].length, SR); let e = 0; for (const d of chs) for (let i = 0; i < n; i++) e += d[i] * d[i]; return 10 * Math.log10(e / (n * chs.length) + 1e-12); };
function writeKit(id, pieces, kbps) {
  for (const [k, zs] of Object.entries(pieces)) {
    if (!zs.length || MIXDB[k] == null) continue;
    const top = Math.max(...zs.map(z => z.v)), lv = zs.filter(z => z.v === top).reduce((a, z) => a + rmsDb(z.chs), 0) / zs.filter(z => z.v === top).length;
    const g = Math.pow(10, (MIXDB[k] - lv) / 20); for (const z of zs) for (const d of z.chs) for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  const all = Object.values(pieces).flat(), ref = Math.max(...all.map(z => peakOf(z.chs))), g = .97 / ref, p = {};
  for (const [k, zs] of Object.entries(pieces)) {
    const layers = new Map();
    for (const x of zs) { const chs = monoIfSame(tidy(x.chs, ref, x.maxSec, x.fade ?? .08)).map(d => d.map(v => v * g)); (layers.get(x.v) || layers.set(x.v, []).get(x.v)).push(mp3(chs, kbps)); }
    p[k] = [...layers].sort((a, b) => a[0] - b[0]).map(([v, l]) => [+v.toFixed(3), l]);
  }
  const file = path.join(out, 'drums-' + id + '.js');
  fs.writeFileSync(file, `KW_SMP(${JSON.stringify('drums-' + id)},${JSON.stringify({ v: 2, p })});\n`);
  console.log(`drums-${id}: ${Object.keys(p).join(' ')} | ${(fs.statSync(file).size / 1048576).toFixed(1)} MB`);
}

// ---------------------------------------------------------------- Bausteine für die Quellen
// Aus Dateinamen Zonen bilden: re liefert [Note, Layer-Nummer, (Variante)]
function byName(r, dir, re, { off = 0, layers, rr = 1, check = false, filter } = {}) {
  const hits = [];
  for (const f of r.files) {
    if (!f.startsWith(dir + '/') || f.slice(dir.length + 1).includes('/')) continue;
    const m = f.slice(dir.length + 1).match(re); if (!m) continue;
    const midi = midiOf(m[1], off); if (midi == null) continue;
    // Stufe als Zahl oder Wort (pp … ff), Variante als Zahl oder Buchstabe (a, b, …)
    const L = LV[String(m[2] ?? 1).toLowerCase()] ?? +(m[2] ?? 1), v = /^[a-z]$/i.test(m[3] || '') ? m[3].toLowerCase().charCodeAt(0) - 96 : +(m[3] ?? 1);
    if (layers && !layers.includes(L)) continue;
    if (v > rr || (filter && !filter(m))) continue;
    hits.push({ f, m: midi, L, v });
  }
  return hits;
}
const LV = { ppp: 1, pp: 2, p: 3, mp: 4, m: 5, mf: 5, f: 6, ff: 7, fff: 8 };
// Layer-Nummern auf obere Velocity-Grenzen verteilen (gleichmäßig)
const velMap = Ls => Object.fromEntries([...new Set(Ls)].sort((a, b) => a - b).map((L, i, a) => [L, (i + 1) / a.length]));
async function inst(r, hits, { maxSec, fade, check, every = 1, lo, hi } = {}) {
  need(r, hits.map(h => h.f));
  const vm = velMap(hits.map(h => h.L));
  // Ausdünnen: nur jede n-te gesampelte Tonhöhe
  const ms = [...new Set(hits.map(h => h.m))].sort((a, b) => a - b), keep = new Set(ms.filter((_, i) => i % every === 0 || i === ms.length - 1));
  const sel = hits.filter(h => keep.has(h.m));
  return (await pool(sel.filter(h => h.m >= (lo ?? 0) && h.m <= (hi ?? 127)), 6, async h => {
    const ms_ = typeof maxSec === 'function' ? maxSec(h.m) : maxSec;
    const chs = await decode(r, h.f, ms_);
    let m = h.m;
    // Oktavlage prüfen (manche Quellen zählen Oktaven anders)
    if (check) { const p = pitchOf(chs[0]); if (p) { const k = Math.round((p - m) / 12); if (k && Math.abs(p - (m + 12 * k)) < 1.2) m += 12 * k; } }
    return { m, v: vm[h.L], chs, maxSec: ms_, fade };
  })).filter(Boolean);
}

// ---------------------------------------------------------------- Instrumente
const P = {
  // Yamaha C5 (Salamander), 4 von 16 Anschlagstufen, alle kleinen Terzen
  'hq-piano': async () => {
    const r = repo('sfzinstruments/SalamanderGrandPiano');
    const hits = byName(r, 'Samples', /^([A-G]#?\d)v(\d+)\.flac$/, { layers: [4, 8, 12, 16] });
    return inst(r, hits, { maxSec: m => m < 45 ? 6.5 : m < 60 ? 5.5 : m < 72 ? 4.5 : m < 84 ? 3.5 : 2.5, fade: .6 });
  },
  // Kontrabass gezupft (D. Smolken), drei Stärken, zwei Varianten
  'hq-jazzbass': async () => {
    const r = repo('sfzinstruments/dsmolken.double-bass');
    return inst(r, byName(r, 'pizz', /^pizz_([a-g]b?\d)_([pmf])([a-d])\.wav$/i, { rr: 2 }), { maxSec: 3.5, fade: .3, check: true });
  },
  // E-Bass (Fender Jazz Bass, Karoryfer Growlybass), vier Stärken
  'hq-fingerbass': async () => {
    const r = repo('sfzinstruments/karoryfer.growlybass');
    return inst(r, byName(r, 'sustain', /^([a-g]b?\d)_(pp|p|f|ff)_rr(\d)\.wav$/i, { rr: 2 }), { maxSec: 3, fade: .3, check: true });
  },
  // Altsaxofon (Karoryfer Weresax), leise und laut
  'hq-altsax': async () => {
    const r = repo('sfzinstruments/karoryfer.weresax');
    return inst(r, byName(r, 'Samples/alto', /^([a-g]b?\d)_(p|f)_rr(\d)_cnd\.wav$/i, { rr: 1 }), { maxSec: 3.5, fade: .3, check: true, every: 2 });
  },
  // Baritonsaxofon von 1926 (Karoryfer Bear Sax)
  // Die Quelle hat kurze Anschläge (…_vl2/vl4) und lange gehaltene Töne ohne Anschlag (…_looped_p/f): beides wird zusammengesetzt
  'hq-barisax': async () => {
    const r = repo('sfzinstruments/karoryfer.bear-sax');
    const att = byName(r, 'Samples', /^([a-g]b?\d)_vl(\d)_rr(\d)\.wav$/i, { rr: 1, layers: [2, 4] });
    const ms = [...new Set(att.map(h => h.m))].sort((a, b) => a - b).filter((_, i) => i % 2 === 0);
    const jobs = att.filter(h => ms.includes(h.m)).map(h => ({ h, loop: r.files.find(f => f.toLowerCase() === `samples/${h.f.split('/').pop().split('_')[0]}_looped_${h.L === 4 ? 'f' : 'p'}.wav`) })).filter(j => j.loop);
    need(r, jobs.flatMap(j => [j.h.f, j.loop]));
    const X = Math.round(.06 * SR), A = Math.round(.42 * SR);
    return pool(jobs, 6, async ({ h, loop }) => {
      const a = await decode(r, h.f, 1), b = await decode(r, loop, 3.5), C = Math.max(a.length, b.length);
      const chs = Array.from({ length: C }, (_, c) => { const x = a[Math.min(c, a.length - 1)], y = b[Math.min(c, b.length - 1)], n = Math.min(A, x.length - X), o = new Float32Array(n + y.length);
        o.set(x.subarray(0, n)); for (let i = 0; i < X; i++) { const w = i / X; o[n + i] = (x[n + i] || 0) * (1 - w) + y[i] * w; } o.set(y.subarray(X), n + X); return o; });
      let m = h.m; const p = pitchOf(chs[0].subarray(A)); if (p) { const k = Math.round((p - m) / 12); if (k && Math.abs(p - (m + 12 * k)) < 1.2) m += 12 * k; }
      return { m, v: h.L === 4 ? 1 : .5, chs, maxSec: 4, fade: .3 };
    });
  },
  // Halbakustische Jazzgitarre (Gretsch, Karoryfer Black And Green Guitars)
  'hq-jazzguitar': async () => {
    const r = repo('sfzinstruments/karoryfer.black-and-green-guitars');
    return inst(r, byName(r, 'Samples/green/ord', /^twang_([a-g]b?\d)_(p|mf|f)_rr(\d)\.wav$/i, { rr: 1 }), { maxSec: 4, fade: .4, check: true, every: 2 });
  },
  // Orchester (VS Chamber Orchestra 2, CC0): Streicher-Ensemble aus Celli, Bratschen und Geigen
  'hq-strings': async () => {
    const r = repo('sgossner/VSCO-2-CE'), re = /_([A-G]#?\d)_v(\d)(?:_\d)?\.wav$/;
    const parts = [
      [byName(r, 'Strings/Cello Section/susvib', re, { off: 12 }), 0, 52],
      [byName(r, 'Strings/Viola Section/susvib', re, { off: 12 }), 53, 64],
      [byName(r, 'Strings/Violin Section/susVib', re, { off: 12 }), 65, 127]];
    return (await Promise.all(parts.map(([h, lo, hi]) => inst(r, h, { maxSec: 4, fade: .5, check: true, lo, hi })))).flat();
  },
  'hq-pizz': async () => {
    const r = repo('sgossner/VSCO-2-CE');
    const a = await inst(r, byName(r, 'Strings/Cello Section/pizzT', /_([A-G]#?\d)_v(\d)(?:_rr)?(\d)?\.wav$/, { off: 12, rr: 1 }), { maxSec: 1.6, fade: .2, check: true, hi: 52 });
    const b = await inst(r, byName(r, 'Strings/Violin Section/Pizz', /_([A-G]#?\d)_v(\d)_rr(\d)\.wav$/, { off: 12, rr: 2 }), { maxSec: 1.6, fade: .2, check: true, lo: 53 });
    return [...a, ...b];
  },
  'hq-horn': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Brass/F Horn/sus', /_([A-G]#?\d)_v(\d)_\d\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-trumpet': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Brass/Trumpet/sus', /_([A-G]#?\d)_v(\d)_rr(\d)\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-trombone': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Brass/Tenor Trombone/sus', /_([A-G]#?\d)_v(\d)_\d\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-flute': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Woodwinds/Flute/susvib', /_([A-G]#?\d)_v(\d)_(\d)\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-clarinet': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Woodwinds/Clarinet/susLong', /_([A-G]#?\d)_v(\d)_rr(\d)_sum\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-oboe': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Woodwinds/Oboe/Vib', /_([A-G]#?\d)_v(\d)_Main\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-bassoon': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Woodwinds/Bassoon/vib', /_([A-G]#?\d)_v(\d)_\d\.wav$/, { off: 12 }), { maxSec: 4, fade: .4, check: true }); },
  'hq-harp': async () => { const r = repo('sgossner/VSCO-2-CE'); return inst(r, byName(r, 'Strings/Harp', /_([A-G]#?\d)_(mf)\.wav$/, { off: 12 }), { maxSec: 4, fade: .5, check: true }); }
};
// Drum-Ordner im Karoryfer-Aufbau: <Instrument>/<Spielweise>/<Mikrofon>/<name>_vl<n>_rr<n>.flac; Mikrofone werden gemischt
async function kitPiece(r, dir, mics, maxSec) {
  const key = f => f.match(/_vl(\d+)_rr(\d+)\.(?:flac|wav)$/i), byMic = {};
  for (const [mic] of mics) { byMic[mic] = new Map(); for (const f of r.files) if (f.startsWith(`${dir}/${mic}/`)) { const k = key(f); if (k) byMic[mic].set(k[1] + '|' + k[2], f); } }
  const vls = [...new Set([...byMic[mics[0][0]].keys()].map(k => +k.split('|')[0]))].sort((a, b) => a - b), N = vls.length, jobs = [];
  // vier Anschlagstufen, je die lauteste Aufnahme des Viertels mit bis zu 3 Varianten
  for (let g = 0; g < 4 && N; g++) {
    const vl = vls[Math.max(0, Math.ceil((g + 1) * N / 4) - 1)];
    for (const rr of [1, 2, 3]) { const parts = mics.map(([mic, gn]) => ({ r, f: byMic[mic].get(vl + '|' + rr), g: gn })); if (parts.every(p => p.f)) jobs.push({ parts, v: (g + 1) / 4 }); }
  }
  need(r, jobs.flatMap(j => j.parts.map(p => p.f)));
  return pool(jobs, 6, async j => ({ chs: await mix(j.parts, maxSec), v: j.v, maxSec, fade: maxSec > 2 ? .4 : .08 }));
}
const KITS = {
  // Rock-Kit (Karoryfer Big Rusty Drums): Nah- und Overhead-Mikrofone gemischt
  hqrock: async () => {
    const r = repo('sfzinstruments/karoryfer.big-rusty-drums'), S = 'Samples/';
    const def = {
      kick: ['kick_24/kick', [['kick', 1], ['oh', .5], ['sn', .25]], 1.2],
      snare: ['snare_14/center', [['top', 1], ['btm', .35], ['oh', .6]], 1.3],
      clap: ['snare_14/rimshot', [['top', 1], ['btm', .35], ['oh', .6]], 1.3],
      rim: ['snare_14/sidestick', [['top', 1], ['oh', .6]], .8],
      hat: ['hihat_14/cl', [['cl', 1], ['oh', .6]], .7],
      ohat: ['hihat_14/open', [['cl', 1], ['oh', .6]], 2.2],
      tom: ['tom_18/center', [['cl', 1], ['oh', .6]], 2],
      conga: ['tom_14/center', [['cl', 1], ['oh', .6]], 1.6],
      crash: ['crash_17/cr', [['cl', .6], ['oh', 1]], 3.5],
      ride: ['ride_22/rd', [['cl', .6], ['oh', 1]], 3]
    };
    const pieces = {};
    for (const [k, [dir, mics, maxSec]] of Object.entries(def)) pieces[k] = await kitPiece(r, S + dir, mics, maxSec);
    return pieces;
  },
  // Jazz-Kit aus Boston (Virtuosity Drums): Nahmikrofone + Overheads + Raum zusammengemischt
  hqjazz: async () => {
    const r = repo('sfzinstruments/virtuosity_drums');
    // Dateinamen: mit Varianten (…_vl2_rr3.flac) oder nur mit vielen Anschlagstufen (…_vl12.flac)
    const f = (mic, piece, art, vl, rr) => { const b = `Samples/${mic}/${piece}/${mic}_${piece}_${art}_vl${vl}`, n = rr ? b + `_rr${rr}.flac` : b + '.flac'; return r.has.has(n) ? n : null; };
    const def = {
      kick: ['kick', 'snon', [['kickmic', 1], ['oh', .55], ['room', .45]], 1.2],
      snare: ['snare', 'center', [['snaremic', .75], ['oh', .8], ['room', .45]], 1.3],
      clap: ['snare', 'rimshot', [['snaremic', .6], ['oh', .8], ['room', .45]], 1.3],
      rim: ['snare', 'crossstick', [['snaremic', .8], ['oh', .8], ['room', .4]], .8],
      hat: ['hh', 'closed', [['oh', 1], ['room', .35]], .6],
      ohat: ['hh', 'open', [['oh', 1], ['room', .35]], 2.2],
      tom: ['ltom', 'center', [['oh', 1], ['mid', .5], ['room', .45]], 2],
      conga: ['htom', 'center', [['oh', 1], ['mid', .5], ['room', .45]], 1.6],
      crash: ['crash', 'crash', [['oh', 1], ['room', .4]], 3.5],
      ride: ['ride', 'ride', [['oh', 1], ['room', .35]], 3]
    };
    const pieces = {};
    for (const [k, [piece, art, mics, maxSec]] of Object.entries(def)) {
      const jobs = [], add = (vl, rr, v) => { const parts = mics.map(([mic, g]) => ({ r, f: f(mic, piece, art, vl, rr), g })).filter(p => p.f); if (parts.length === mics.length) jobs.push({ parts, v }); };
      const vls = Array.from({ length: 30 }, (_, i) => i + 1).filter(v => f('oh', piece, art, v, 1));
      if (vls.length) { const vm = velMap(vls); for (const vl of vls) for (const rr of [1, 2, 3]) add(vl, rr, vm[vl]); }
      else {
        // Viele Stufen ohne Varianten: in 4 Anschlagstufen teilen, die oberen 3 Aufnahmen jeder Stufe wechseln sich ab
        const all = Array.from({ length: 30 }, (_, i) => i + 1).filter(v => f('oh', piece, art, v, 0)), N = all.length;
        for (let g = 0; g < 4; g++) all.slice(Math.floor(g * N / 4), Math.floor((g + 1) * N / 4)).slice(-3).forEach(vl => add(vl, 0, (g + 1) / 4));
      }
      if (!jobs.length) { console.warn('keine Samples für', k); continue; }
      need(r, jobs.flatMap(j => j.parts.map(p => p.f)));
      pieces[k] = await pool(jobs, 6, async j => ({ chs: await mix(j.parts, maxSec), v: j.v, maxSec, fade: maxSec > 2 ? .4 : .08 }));
    }
    // Kuhglocke und Shaker aus der Percussion-Sammlung derselben Aufnahme
    for (const [k, dir, maxSec] of [['cow', 'Samples/perc/oh/cowbell', 1.2], ['shaker', 'Samples/perc/oh/shaker', .8]]) {
      const fl = r.files.filter(x => x.startsWith(dir + '/')).slice(0, 4); need(r, fl);
      pieces[k] = await pool(fl, 4, async x => ({ chs: await mix([{ r, f: x }], maxSec), v: 1, maxSec, fade: .08 }));
    }
    return pieces;
  }
};

(async () => {
  const want = process.argv.slice(2);
  for (const [id, fn] of Object.entries(P)) if (!want.length || want.includes(id)) {
    const res = await fn(); if (Array.isArray(res)) writeInst(id, res, 128);
  }
  for (const [id, fn] of Object.entries(KITS)) if (!want.length || want.includes(id)) writeKit(id, await fn(), 160);
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
