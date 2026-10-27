// Lädt Drumcomputer-Samples (smpldsnds/drum-machines, gemeinfrei) und packt sie als
// src/samples/drums-<kit>.js. Braucht curl und ffmpeg. Aufruf: node scripts/fetch-drums.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/samples'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kwd-'));
const BASE = 'https://raw.githubusercontent.com/smpldsnds/drum-machines/main/';
// Klangwerk-Instrument -> Sample im jeweiligen Ordner
const KITS = {
  tr808: ['TR-808', { kick: 'kick/bd2550', snare: 'snare/sd5050', clap: 'clap/cp', hat: 'hihat-close/ch', ohat: 'hihat-open/oh25', tom: 'mid-tom/mt50', rim: 'rimshot/rs', cow: 'cowbell/cb', crash: 'cymbal/cy5050', ride: 'cymbal/cy7525', shaker: 'maraca/ma', conga: 'conga-mid/mc50' }],
  lm2: ['LM-2', { kick: 'kick', snare: 'snare-m', clap: 'clap', hat: 'hhclosed', ohat: 'hhopen', tom: 'tom-m', rim: 'stick-m', cow: 'cowbell', crash: 'crash', ride: 'ride', shaker: 'cabasa', conga: 'conga-m' }],
  rz1: ['Casio-RZ1', { kick: 'kick', snare: 'snare', clap: 'clap', hat: 'hihat-closed', ohat: 'hihat-open', tom: 'tom-2', rim: 'clave', cow: 'cowbell', crash: 'crash', ride: 'ride' }],
  cr8000: ['Roland-CR-8000', { kick: 'kick', snare: 'snare', clap: 'clap', hat: 'hihat-closed', ohat: 'hihat-open', tom: 'tom-low', rim: 'rimshot', cow: 'cowbell', crash: 'cymball', conga: 'conga-high' }],
  mfb512: ['MFB-512', { kick: 'kick', snare: 'snare', clap: 'clap', hat: 'hihat-closed', ohat: 'hihat-open', tom: 'tom-mid', crash: 'cymbal' }],
  mr10: ['Yamaha-MR10', { kick: 'kick', snare: 'snare', hat: 'chihat', ohat: 'ohihat', tom: 'midtom', rim: 'shortsn', crash: 'crash', ride: 'cymbal', shaker: 'shaker' }],
  sk1: ['Casio-SK1', { kick: 'kick', snare: 'snare', hat: 'hithat', ohat: 'hihat-open', tom: 'tom-hi' }],
  // Neu in v1.2
  drumtraks: ['Sequential-Circuits-Drumtraks', { kick: 'DT_Kick', snare: 'DT_Snare', clap: 'DT_Clap', hat: 'DT_Closedhat', ohat: 'DT_Openhat', tom: 'DT_Tom01', rim: 'DT_Rimshot', cow: 'DT_Cowbell', crash: 'DT_Crash', ride: 'DT_Ride', shaker: 'DT_Cabasa', conga: 'DT_Tom02' }],
  '808mini': ['808-mini', { kick: 'kick', snare: 'snare-2', clap: 'snare-3', hat: 'hhclosed-1', ohat: 'hhopen-1', tom: 'tom-mid', crash: 'crash', ride: 'ride', conga: 'tom-high' }]
};
// Optional nur bestimmte Kits: node scripts/fetch-drums.js drumtraks,808mini
const pick = new Set((process.argv[2] || '').split(',').filter(Boolean));
fs.mkdirSync(out, { recursive: true });
for (const [id, [dir, map]] of Object.entries(KITS)) {
  if (pick.size && !pick.has(id)) continue;
  const data = {};
  for (const [piece, name] of Object.entries(map)) {
    const raw = path.join(tmp, 'raw.ogg'), enc = path.join(tmp, 'enc.mp3');
    execFileSync('curl', ['-sfL', '--max-time', '60', '-o', raw, BASE + dir + '/' + name.split('/').map(encodeURIComponent).join('/') + '.ogg']);
    const max = piece === 'crash' || piece === 'ride' ? 3 : 2;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-t', String(max), '-af', `afade=t=out:st=${max - .1}:d=0.1`, '-ac', '1', '-ar', '44100', '-b:a', '96k', enc]);
    data[piece] = fs.readFileSync(enc).toString('base64');
  }
  fs.writeFileSync(path.join(out, 'drums-' + id + '.js'), `KW_SMP(${JSON.stringify('drums-' + id)},${JSON.stringify(data)});\n`);
  console.log(id, Object.keys(data).length, 'Sounds');
}
fs.rmSync(tmp, { recursive: true });
