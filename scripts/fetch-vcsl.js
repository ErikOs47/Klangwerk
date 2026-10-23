// Lädt Samples aus dem Versilian Community Sample Library (VCSL, CC0, github.com/sgossner/VCSL) und baut daraus
// - echte Instrumente (src/samples/<id>.js, etwa alle drei Halbtöne ein Ton),
// - zwei Sample-Drumkits (src/samples/drums-vcsl.js, drums-vcslperc.js),
// - Loops zum Choppen im Sampler (src/samples/loop-<id>.js), die hier aus Einzelschlägen und -tönen zusammengesetzt werden.
// Braucht git, curl und ffmpeg. Aufruf: node scripts/fetch-vcsl.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, execFile } = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/samples'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kwv-'));
const BASE = 'https://raw.githubusercontent.com/sgossner/VCSL/master/', SR = 44100;
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = n => { const x = n.match(/^([A-G]#?)(-?\d)$/); return 12 * (+x[2] + 1) + NOTE[x[1]]; };

// Dateiliste ohne Audiodaten holen
const repo = path.join(tmp, 'vcsl');
execFileSync('git', ['clone', '-q', '--filter=blob:none', '--no-checkout', '--depth', '1', 'https://github.com/sgossner/VCSL.git', repo]);
const FILES = execFileSync('git', ['-C', repo, 'ls-tree', '-r', '--name-only', 'HEAD'], { maxBuffer: 1 << 26 }).toString().split('\n').filter(f => /\.wav$/i.test(f));
const find = (dir, re) => FILES.filter(f => f.startsWith(dir + '/') && re.test(f.slice(dir.length + 1)));
const one = (dir, name) => { const f = FILES.find(f => f.startsWith(dir + '/') && f.endsWith('/' + name)); if (!f) throw new Error('fehlt: ' + dir + ' ' + name); return f; };

// Laden und als Mono-Float32 dekodieren (mit Zwischenspeicher)
const cache = new Map();
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 1 << 28, encoding: 'buffer' }, (e, so) => e ? rej(e) : res(so)));
function pcm(file, maxSec = 6) {
  const key = file + '|' + maxSec;
  if (!cache.has(key)) cache.set(key, (async () => {
    const raw = path.join(tmp, 'f' + cache.size + '.wav');
    for (let i = 0; ; i++) {
      try { await run('curl', ['-sfL', '--max-time', '120', '-o', raw, BASE + file.split('/').map(encodeURIComponent).join('/')]); break; }
      catch (e) { if (i > 3) throw new Error('Download fehlgeschlagen: ' + file); }
    }
    const b = await run('ffmpeg', ['-v', 'error', '-i', raw, '-t', String(maxSec), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-']);
    fs.rmSync(raw);
    return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  })());
  return cache.get(key);
}
async function pool(items, n, fn) { const res = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]); } })); return res; }

// Stille am Anfang wegschneiden, auf Spitzenpegel bringen, am Ende ausblenden
function tidy(d, maxSec, fade = .12) {
  let s = 0; while (s < d.length && Math.abs(d[s]) < .003) s++;
  s = Math.max(0, s - 24);
  let e = Math.min(d.length, s + Math.round(maxSec * SR)), pk = 0;
  const x = d.slice(s, e); for (const v of x) pk = Math.max(pk, Math.abs(v));
  const g = pk > 1e-4 ? .97 / pk : 1, nf = Math.min(x.length, Math.round(fade * SR));
  for (let i = 0; i < x.length; i++) x[i] *= g * (i >= x.length - nf ? (x.length - i) / nf : 1);
  return x;
}
// Float32 -> MP3 (Base64)
function mp3(x, kbps) {
  const raw = path.join(tmp, 'o.f32'), enc = path.join(tmp, 'o.mp3');
  fs.writeFileSync(raw, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', raw, '-b:a', kbps + 'k', enc]);
  return fs.readFileSync(enc).toString('base64');
}
// Grundton grob per Autokorrelation (für die Oktavlage, die in VCSL nicht einheitlich benannt ist)
function pitchOf(d) {
  const a = Math.round(.08 * SR), N = Math.min(8192, d.length - a - 2048); if (N < 2048) return 0;
  const r = []; let mx = 0;
  for (let l = 20; l < 1800; l++) { let s = 0; for (let i = a; i < a + N; i++) s += d[i] * d[i + l]; r[l] = s; if (s > mx) mx = s; }
  for (let l = 21; l < 1799; l++) if (r[l] > .85 * mx && r[l] >= r[l - 1] && r[l] >= r[l + 1]) return 69 + 12 * Math.log2(SR / l / 440);
  return 0;
}

// ---------- Instrumente ----------
// dir: Ordner, re: Dateimuster mit Notenname als erster Gruppe, dur: Länge je Ton in Sekunden
const INSTR = {
  vibraphone: { dir: 'Idiophones/Struck Idiophones/Vibraphone/Hard Mallets', re: /_([A-G]#?\d)_v3_/, dur: 4 },
  marimba: { dir: 'Idiophones/Struck Idiophones/Marimba', re: /_([A-G]#?\d)_loud_/, dur: 2.5 },
  kalimba: { dir: 'Idiophones/Plucked Idiophones/Kalimba, Kenya', re: /_([A-G]#?\d)_k\d+_/, dur: 3 },
  balafon: { dir: 'Idiophones/Struck Idiophones/Balafon/Hard Mallet', re: /_([A-G]#?\d)_vl3_/, dur: 2 },
  'tenor-sax': { dir: 'Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato', re: /_([A-G]#?\d)_vl3_/, dur: 3.5 },
  harmonica: { dir: 'Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/Sustains/Vib', re: /_([A-G]#?\d)\.wav$/, dur: 3.5 },
  ocarina: { dir: 'Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib', re: /_([A-G]#?\d)\.wav$/, dur: 3.5 },
  harpsichord: { dir: 'Chordophones/Zithers/Harpsichord, Flemish/Sustains/Low', re: /_([A-G]#?\d)_rr1/, dur: 3.5 },
  'renaissance-organ': { dir: "Aerophones/Edge-blown Aerophones/Renaissance Organ/8'", re: /_([A-G]#?\d)_rr1/, dur: 3.5 },
  'folk-harp': { dir: 'Chordophones/Composite Chordophones/Folk Harp', re: /_([A-G]#?\d)_v3_/, dur: 3.5 },
  // Neu in v0.9
  'fm-piano': { dir: 'Electrophones/TX81Z/FM Piano', re: /_([A-G]#?\d)_vl3/, dur: 3.5 },
  clavisynth: { dir: 'Electrophones/TX81Z/Clavisynth', re: /_([A-G]#?\d)_vl3/, dur: 2.5 },
  'upright-piano': { dir: 'Chordophones/Zithers/Upright Piano, Yamaha/Sustains', re: /_Sus_([A-G]#?\d)_vl3_rr1/, dur: 4.5 },
  'pipe-organ': { dir: 'Aerophones/Edge-blown Aerophones/Pipe Organ/Loud', re: /_([A-G]#?\d)\.wav$/, dur: 4 },
  glockenspiel: { dir: 'Idiophones/Struck Idiophones/Glockenspiel', re: /_loud_([A-G]#?\d)_01/, dur: 3 },
  'tubular-bells': { dir: 'Idiophones/Struck Idiophones/Tubular Bells 1', re: /chimes_([A-G]#?\d)_f+_/, dur: 5 },
  'hand-chimes': { dir: 'Idiophones/Struck Idiophones/Hand Chimes', re: /(?:^|\/)sus_([A-G]#?\d)_r01/, dur: 4 },
  'dan-tranh': { dir: 'Chordophones/Zithers/Dan Tranh/Normal', re: /(?:^|\/)([A-G]#?\d)_f_1\.wav$/, dur: 3 },
  recorder: { dir: 'Aerophones/Edge-blown Aerophones/Baroque Alto Recorder/Sustain', re: /_Sus_([A-G]#?\d)_rr1/, dur: 3 },
  mbira: { dir: 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B', re: /_Main_([A-G]#?\d)_\d+_/, dur: 3 }
};
// Gruppiert passende Dateien nach Tonhöhe und korrigiert die Oktave anhand der gemessenen Tonhöhe (Median)
async function noteSet(dir, re, maxSec) {
  const by = new Map();
  for (const f of find(dir, re)) { const m = midi(f.match(re)[1]); if (!by.has(m)) by.set(m, f); }
  const ms = [...by.keys()].sort((a, b) => a - b), d = await pool(ms, 8, m => pcm(by.get(m), maxSec + .5));
  const sh = ms.map((m, i) => { const p = pitchOf(d[i]); return p ? Math.round((p - m) / 12) * 12 : null; }).filter(x => x !== null).sort((a, b) => a - b);
  const shift = sh.length ? sh[sh.length >> 1] : 0;
  return ms.map((m, i) => ({ m: m + shift, d: d[i] }));
}
// Zweites Argument: nur diese ids neu bauen, z. B. node scripts/fetch-vcsl.js instruments mbira,recorder
const pick = new Set((process.argv[3] || '').split(',').filter(Boolean)), want = id => !pick.size || pick.has(id);
async function instruments() {
  for (const [id, o] of Object.entries(INSTR)) {
    if (!want(id)) continue;
    const set = await noteSet(o.dir, o.re, o.dur), data = {}; let last = -99;
    for (const z of set) if (z.m - last >= 3) { data[z.m] = mp3(tidy(z.d, o.dur, .25), 64); last = z.m; }
    fs.writeFileSync(path.join(out, id + '.js'), `KW_SMP(${JSON.stringify(id)},${JSON.stringify(data)});\n`);
    console.log(id, Object.keys(data).length, 'Töne', Object.keys(data).join(' '));
  }
}

// ---------- Drumkits ----------
const P = {
  bd: 'Membranophones/Struck Membranophones/Bass Drum 1', sn: 'Membranophones/Struck Membranophones/Snare Drum, Modern 1',
  old: 'Membranophones/Struck Membranophones/Legacy Snares/OldSnare', hh: 'Idiophones/Struck Idiophones/Hi-Hat Cymbal',
  tom: 'Membranophones/Struck Membranophones/Tom 1', cym: 'Idiophones/Struck Idiophones/Suspended Cymbal 1',
  clap: 'Idiophones/Struck Idiophones/Claps', cow: 'Idiophones/Struck Idiophones/Cowbells', ss: 'Idiophones/Struck Idiophones/Shaker, Small',
  ls: 'Idiophones/Struck Idiophones/Shaker, Large', conga: 'Membranophones/Struck Membranophones/Conga', bongo: 'Membranophones/Struck Membranophones/Bongos',
  cajon: 'Idiophones/Struck Idiophones/Cajon', tamb: 'Idiophones/Struck Idiophones/Tambourine 1', clave: 'Idiophones/Struck Idiophones/Claves',
  agogo: 'Idiophones/Struck Idiophones/Agogo Bells', tri: 'Idiophones/Struck Idiophones/Triangles',
  darb: 'Membranophones/Struck Membranophones/Darbuka', frame: 'Membranophones/Struck Membranophones/Frame Drum', cabasa: 'Idiophones/Struck Idiophones/Cabasa',
  sleigh: 'Idiophones/Struck Idiophones/Sleigh Bells', slit: 'Idiophones/Struck Idiophones/Slit Drum', wood: 'Idiophones/Struck Idiophones/Woodblock',
  fing: 'Idiophones/Struck Idiophones/Finger Cymbals', guiro: 'Idiophones/Struck Idiophones/Guiro', tamb2: 'Idiophones/Struck Idiophones/Tambourine 2',
  bd2: 'Membranophones/Struck Membranophones/Bass Drum 2', rope: 'Membranophones/Struck Membranophones/Snare Drum, Rope Tension/Hi',
  anvil: 'Idiophones/Struck Idiophones/Anvil', timp: 'Membranophones/Struck Membranophones/Timpani 1/Hit', slap: 'Idiophones/Struck Idiophones/Slapstick',
  bells: 'Idiophones/Struck Idiophones/Tubular Bells 1', clash: 'Idiophones/Struck Idiophones/Clash Cymbals 1', gong: 'Idiophones/Struck Idiophones/Gong 1',
  ratchet: 'Idiophones/Struck Idiophones/Ratchet'
};
const KITS = {
  vcsl: {
    kick: [P.bd, 'BDrumNew_hit_v7_rr1_Sum.wav'], snare: [P.sn, 'Snare2_HitSN_v7_rr1_Mid.wav'], clap: [P.clap, 'Clap_rr1.wav'],
    hat: [P.hh, 'HiHat_HitC_v3_rr1_Mid.wav'], ohat: [P.hh, 'HiHat_HitO_rr1_Mid.wav'], tom: [P.tom, 'TomH_HitS_v3_rr1_Mid.wav'],
    rim: [P.sn, 'Snare2_stick_v1_rr1_Mid.wav'], cow: [P.cow, 'Cowbell1_Hit_v3_rr1_Mid.wav'], crash: [P.cym, 'susCymb1_hit_stick_f1.wav'],
    ride: [P.cym, 'susCymb1_hit_bell_mf1.wav'], shaker: [P.ss, 'Mid_ShakerDouble_Down_rr1.wav'], conga: [P.conga, 'Conga_HitN_v2_rr1_Sum.wav']
  },
  vcslperc: {
    kick: [P.cajon, 'Cajon_hit1_f_rr1.wav'], snare: [P.cajon, 'Cajon_hit3_f_rr1.wav'], clap: [P.clap, 'SoloClap_vl3.wav'],
    hat: [P.ss, 'Mid_ShakerHighFaster_Down_rr1.wav'], ohat: [P.tamb, 'Tamb1_Hit_v2_rr1_Mid.wav'], tom: [P.conga, 'Tumba_HitN_v3_rr1_Sum.wav'],
    rim: [P.clave, 'Claves1_Hit_v2_rr1_Mid.wav'], cow: [P.agogo, 'Agogo_High_v2_rr1_Mid.wav'], crash: [P.tri, 'Triangle1_Hit_v2_rr1_Mid.wav'],
    ride: [P.agogo, 'Agogo_Low_v2_rr1_Mid.wav'], shaker: [P.ls, 'LShaker_Hit_rr1_Mid.wav'], conga: [P.conga, 'Quinto_HitN_v2_rr1_Sum.wav']
  },
  // Neu in v0.9
  vcslworld: {
    kick: [P.darb, 'Darbuka_1_hit_vl2_rr1.wav'], snare: [P.darb, 'Darbuka_2_hit_vl2_rr1.wav'], clap: [P.darb, 'Darbuka_3_hit_vl2_rr1.wav'],
    hat: [P.cabasa, 'Cabasa1_Hit_rr1_Mid.wav'], ohat: [P.sleigh, 'Sleighbells_Hit_rr1_Mid.wav'], tom: [P.frame, 'HDrumL_Hit_v3_rr1_Sum.wav', 1.5],
    rim: [P.wood, 'wood_click_f_rr1.wav'], cow: [P.slit, 'LogDrumHi_MedM_v3_rr1_Sum.wav'], crash: [P.fing, 'Fing_Cymb.wav'],
    ride: [P.guiro, 'Guiro_Hit_rr1_Mid.wav'], shaker: [P.tamb2, 'Tamb2_Shake_rr3_Mid.wav'], conga: [P.slit, 'LogDrumLo_MedM_v3_rr1_Sum.wav']
  },
  vcslorch: {
    kick: [P.bd2, 'bassdrum_hit_f.wav'], snare: [P.rope, 'RopeSnare_hi_sn_Main_vl3_rr1.wav'], clap: [P.anvil, 'Anvil_Hit1_v3_rr1_Mid.wav'],
    hat: [P.tamb2, 'Tamb2_Hit_v2_rr2_Mid.wav'], ohat: [P.sleigh, 'sleighbell2_hit_loud.wav'], tom: [P.timp, 'Timpani1_Hit_v4_rr1_Sum.wav', 2.5],
    rim: [P.slap, 'slapstick_rr1.wav'], cow: [P.bells, 'chimes_C4_ff_rr2.wav', 3], crash: [P.clash, 'cymbal_crash1_ff2.wav'],
    ride: [P.gong, 'gong_f.wav', 4], shaker: [P.ratchet, 'Ratchet1_Fast_rr1_Mid.wav'], conga: [P.timp, 'Timpani2_Hit_v4_rr1_Sum.wav', 2.5]
  }
};
async function kits() {
  for (const [id, map] of Object.entries(KITS)) {
    if (!want(id)) continue;
    const data = {};
    for (const [piece, [dir, name, mx]] of Object.entries(map)) {
      const max = mx || piece === 'crash' || piece === 'ride' ? 3 : piece === 'ohat' ? 1.5 : 1;
      data[piece] = mp3(tidy(await pcm(one(dir, name)), max, .08), 96);
    }
    fs.writeFileSync(path.join(out, 'drums-' + id + '.js'), `KW_SMP(${JSON.stringify('drums-' + id)},${JSON.stringify(data)});\n`);
    console.log('drums-' + id, Object.keys(data).length, 'Sounds');
  }
}

// ---------- Loops ----------
// Kleiner Sequenzer: Spuren als Rasterzeichen (x = voll, o = leise, - = mittel), Melodien als [Schritt, Note, Länge, Stärke]
async function hit(dir, name, max = 1.2) { return tidy(await pcm(one(dir, name)), max, .05); }
function mixIn(buf, s, at, gain, rate = 1, len = Infinity, fade = .04) {
  const st = Math.round(at * SR), n = Math.min(Math.floor((s.length - 1) / rate), Math.round(len * SR)), nf = Math.round(fade * SR);
  for (let i = 0; i < n && st + i < buf.length; i++) {
    const p = i * rate, k = p | 0, v = s[k] + (s[k + 1] - s[k]) * (p - k);
    buf[st + i] += v * gain * (len < Infinity && i > n - nf ? (n - i) / nf : 1);
  }
}
function render(L, lanes, melody) {
  const step = 60 / L.bpm / (L.grid / 4), barLen = step * L.grid, buf = new Float32Array(Math.round(barLen * L.bars * SR) + SR * 2);
  const at = k => k * step + (L.swing && k % 2 ? L.swing * step : 0);
  for (const [s, pat, g] of lanes) {
    const str = pat.replace(/\s/g, '').repeat(Math.ceil(L.grid * L.bars / pat.replace(/\s/g, '').length));
    for (let k = 0; k < L.grid * L.bars; k++) {
      const c = str[k], v = c === 'x' ? 1 : c === '-' ? .6 : c === 'o' ? .3 : 0;
      if (v) mixIn(buf, Array.isArray(s) ? s[k % s.length] : s, at(k), g * v);
    }
  }
  if (melody) {
    const { set, ev, gain } = melody;
    for (const [k, m, len, v = 1] of ev) {
      const z = set.reduce((a, b) => Math.abs(b.m - m) < Math.abs(a.m - m) ? b : a);
      mixIn(buf, z.d, at(k), gain * v, Math.pow(2, (m - z.m) / 12), len * step, .05);
    }
  }
  // Nachklang des letzten Schlags an den Anfang falten, damit der Loop nahtlos ist
  const n = Math.round(barLen * L.bars * SR), x = buf.slice(0, n);
  for (let i = n; i < buf.length; i++) x[i - n] += buf[i];
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < n; i++) x[i] *= .9 / pk;
  return x;
}
const chord = (k, notes, len, v = .8) => notes.map(m => [k, m, len, v]);
async function loops() {
  const kick = await hit(P.bd, 'BDrumNew_hit_v7_rr1_Sum.wav', .6), kick2 = await hit(P.bd, 'BDrumNew_hit_v5_rr2_Sum.wav', .6);
  const sn = await hit(P.sn, 'Snare2_HitSN_v7_rr1_Mid.wav', .5), sn2 = await hit(P.sn, 'Snare2_HitSN_v9_rr2_Mid.wav', .5), ghost = await hit(P.sn, 'Snare2_HitSN_v3_rr1_Mid.wav', .3);
  const old = await hit(P.old, 'snare_f1.wav', .5), hc = [await hit(P.hh, 'HiHat_HitC_v3_rr1_Mid.wav', .3), await hit(P.hh, 'HiHat_HitC_v2_rr2_Mid.wav', .3)];
  const ho = await hit(P.hh, 'HiHat_HitO_rr1_Mid.wav', .7), tamb = await hit(P.tamb, 'Tamb1_Hit_v2_rr1_Mid.wav', .5);
  const cajB = await hit(P.cajon, 'Cajon_hit1_f_rr1.wav', .6), cajS = await hit(P.cajon, 'Cajon_hit3_f_rr1.wav', .5), cajG = await hit(P.cajon, 'Cajon_hit2_pp_rr1.wav', .3);
  const sh = [await hit(P.ss, 'Mid_ShakerDouble_Down_rr1.wav', .25), await hit(P.ss, 'Mid_ShakerDouble_Up_rr1.wav', .25)];
  const tumba = await hit(P.conga, 'Tumba_HitN_v3_rr1_Sum.wav', .8), conga = await hit(P.conga, 'Conga_HitN_v2_rr1_Sum.wav', .6), cmute = await hit(P.conga, 'Conga_HitFM_v2_rr1_Sum.wav', .4);
  const quinto = await hit(P.conga, 'Quinto_HitN_v2_rr1_Sum.wav', .5), bh = await hit(P.bongo, 'BongoH_Hit1_v2_rr1_Mid.wav', .4), bl = await hit(P.bongo, 'BongoL_Hit1_v2_rr1_Mid.wav', .4);
  const clave = await hit(P.clave, 'Claves1_Hit_v2_rr1_Mid.wav', .3), cow = await hit(P.cow, 'Cowbell1_Muted_v3_rr1_Mid.wav', .3);
  const piano = await noteSet('Chordophones/Zithers/Grand Piano, Steinway B/NoSus', /_([A-G]#?\d)_vl3_/, 3);
  const inst = id => noteSet(INSTR[id].dir, INSTR[id].re, INSTR[id].dur);

  const L = {
    'funk-break': [{ bpm: 96, grid: 16, bars: 2 }, [
      [kick, 'x.x.......x..x.. x.x....x..x.....', 1], [[sn, sn2], '....x..o.o..x..o ....x..o.o..x.o.', .8], [ghost, '................ ..............o.', .5],
      [hc, 'x-x-x-x-x-x-x... x-x-x-x-x-x-x-x.', .45], [ho, '..............x. ................', .4]]],
    'boombap-break': [{ bpm: 88, grid: 16, bars: 2, swing: .16 }, [
      [[kick, kick2], 'x......x..x..... x.x....x..x..x..', 1], [old, '....x.......x... ....x.......x...', .9], [ghost, '.........o...... .........o.....o', .5],
      [hc, 'x-x-x-x-x-x-x-x- x-x-x-x-x-x-x-x-', .4], [tamb, '....x.......x... ....x.......x...', .25]]],
    'shuffle-break': [{ bpm: 104, grid: 12, bars: 2 }, [
      [kick, 'x.....x.x... x.....x....x', 1], [sn, '...x.....x.. ...x.....x..', .8], [ghost, '.....o.....o .....o..o..o', .45],
      [hc, 'x.-x.-x.-x.- x.-x.-x.-x.-', .45], [ho, '............ ..........x.', .35]]],
    'cajon-groove': [{ bpm: 92, grid: 16, bars: 2 }, [
      [cajB, 'x.....x...x..... x.....x...x...x.', 1], [cajS, '....x.......x... ....x.......x..x', .85], [cajG, '..o..o.o..o..o.o ..o..o.o..o.....', .6],
      [sh, 'x-o-x-o-x-o-x-o- x-o-x-o-x-o-x-o-', .35]]],
    'conga-groove': [{ bpm: 110, grid: 16, bars: 2 }, [
      [clave, 'x.....x.....x... ....x...x.......', .5], [tumba, '..............x. ..............xx', .9], [conga, '......xx........ ......xx........', .7],
      [cmute, '....x.......x... ....x.......x...', .6], [[bh, bh, bl, bh], 'x-o-x-o-x-o-x-o- x-o-x-o-x-o-x-o-', .45], [quinto, '.........x...... ...........x.x..', .5],
      [cow, 'x...x...x...x... x...x...x...x...', .3]]]
  };
  const M = {
    'soul-keys': [{ bpm: 84, grid: 16, bars: 4 }, piano, .5, [[53, 57, 60, 64, 41], [52, 55, 59, 62, 40], [50, 53, 57, 60, 64, 38], [55, 59, 62, 65, 43]]
      .flatMap((c, b) => [...chord(b * 16, c, 10, .85), ...chord(b * 16 + 10, c.slice(0, 4), 2, .5), ...chord(b * 16 + 14, c.slice(0, 4), 2, .6)])],
    'vibes-phrase': [{ bpm: 90, grid: 16, bars: 2 }, 'vibraphone', .55, [[0, 72, 2], [2, 75, 2], [4, 79, 4], [8, 77, 2], [10, 75, 2], [12, 72, 4], [16, 70, 2], [18, 72, 2], [20, 75, 6], [26, 77, 2], [28, 79, 4],
      ...chord(0, [60, 63, 67], 16, .35), ...chord(16, [58, 62, 65], 16, .35)]],
    'kalimba-riff': [{ bpm: 100, grid: 16, bars: 2 }, 'kalimba', .6, [67, 71, 74, 79, 76, 74, 71, 74, 64, 67, 71, 76, 74, 71, 67, 71].map((m, i) => [i * 2, m, 3, i % 4 ? .7 : 1])],
    'marimba-line': [{ bpm: 96, grid: 16, bars: 2 }, 'marimba', .55, [57, 60, 64, 69, 64, 60, 64, 67, 53, 57, 60, 65, 60, 57, 60, 64, 55, 59, 62, 67, 62, 59, 62, 65, 52, 55, 59, 64, 59, 55, 59, 62]
      .map((m, i) => [i, m, 2, i % 4 ? .65 : 1])],
    'harp-arp': [{ bpm: 80, grid: 16, bars: 2 }, 'folk-harp', .5, [48, 55, 60, 64, 67, 71, 72, 67, 64, 60, 55, 60, 64, 67, 71, 74, 45, 52, 57, 60, 64, 67, 69, 64, 60, 57, 52, 57, 60, 64, 67, 72]
      .map((m, i) => [i, m, 8, i % 4 ? .7 : 1])],
    'organ-stabs': [{ bpm: 90, grid: 16, bars: 4 }, 'renaissance-organ', .45, [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
      .flatMap((c, b) => [[b * 16, c[0] - 12, 14, .7], ...[2, 6, 10, 14].flatMap(k => chord(b * 16 + k, c, 1.5, .8))])],
    'sax-licks': [{ bpm: 92, grid: 16, bars: 2 }, 'tenor-sax', .6, [[0, 65, 2], [2, 68, 1], [3, 70, 3], [6, 68, 2], [8, 65, 2], [10, 63, 1], [11, 64, 1], [12, 63, 2], [14, 61, 2],
      [16, 58, 4], [22, 61, 2], [24, 63, 2], [26, 65, 5]]]
  };
  const save = (id, x) => { fs.writeFileSync(path.join(out, 'loop-' + id + '.js'), `KW_SMP(${JSON.stringify('loop-' + id)},${JSON.stringify(mp3(x, 112))});\n`); console.log('loop-' + id, (x.length / SR).toFixed(2) + ' s'); };
  for (const [id, [cfg, lanes]] of Object.entries(L)) save(id, render(cfg, lanes));
  for (const [id, [cfg, src, gain, ev]] of Object.entries(M)) save(id, render(cfg, [], { set: typeof src === 'string' ? await inst(src) : src, ev, gain }));
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const only = process.argv[2];
  if (!only || only === 'instruments') await instruments();
  if (!only || only === 'kits') await kits();
  if (!only || only === 'loops') await loops();
  fs.rmSync(tmp, { recursive: true });
})().catch(e => { console.error(e); process.exit(1); });
