// Lädt die freien Instrument-Samples (tonejs-instruments, CC-BY 3.0) und packt sie
// als kleine Skriptdateien nach src/samples/<instrument>.js. Braucht curl und ffmpeg.
// Aufruf: node scripts/fetch-samples.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/samples'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-'));
const BASE = 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/';
// Länge pro Sample in Sekunden; gehaltene Instrumente werden in der App per Schleife verlängert
const DUR = { piano: 5, harp: 4, 'guitar-acoustic': 4, 'guitar-electric': 4, 'guitar-nylon': 4, xylophone: 2, 'bass-electric': 3 };
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = n => { const x = n.match(/^([A-G]#?)(\d)$/); return 12 * (+x[2] + 1) + NOTE[x[1]]; };
const get = (url, file) => execFileSync('curl', ['-sfL', '--max-time', '60', '-o', file, url]);

const lib = path.join(tmp, 'lib.js'); get(BASE + 'Tonejs-Instruments.js', lib);
const src = fs.readFileSync(lib, 'utf8'), re = /'([a-z-]+)': \{([^}]*)\}/g;
fs.mkdirSync(out, { recursive: true });
for (let m; (m = re.exec(src));) {
  const inst = m[1], notes = [...new Set([...m[2].matchAll(/'([A-G]#?\d)'/g)].map(x => x[1]))].sort((a, b) => midi(a) - midi(b));
  const pick = []; let last = -99;
  for (const n of notes) if (midi(n) - last >= 3) { pick.push(n); last = midi(n); } // etwa alle drei Halbtöne ein Sample
  const data = {};
  for (const n of pick) {
    const raw = path.join(tmp, 'raw.mp3'), enc = path.join(tmp, 'enc.mp3');
    get(`${BASE}samples/${inst}/${n.replace('#', 's')}.mp3`, raw);
    const len = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]);
    const d = Math.min(len, DUR[inst] || 3.5);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-t', String(d), '-af', `afade=t=out:st=${d - .25}:d=0.25`, '-ac', '1', '-ar', '44100', '-b:a', '64k', enc]);
    data[midi(n)] = fs.readFileSync(enc).toString('base64');
  }
  fs.writeFileSync(path.join(out, inst + '.js'), `KW_SMP(${JSON.stringify(inst)},${JSON.stringify(data)});\n`);
  console.log(inst, pick.length, 'Samples');
}
fs.rmSync(tmp, { recursive: true });
