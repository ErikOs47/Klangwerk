// Lädt Instrumente aus dem FluidR3-GM-Soundfont (vorgerendert von gleitz/midi-js-soundfonts, CC-BY 3.0)
// und packt sie als src/samples/gm-<id>.js (etwa alle vier Halbtöne ein Ton). Braucht curl und ffmpeg.
// Aufruf: node scripts/fetch-gm.js            alle neu bauen
//         node scripts/fetch-gm.js oboe,koto  nur diese ids
const fs = require('fs'), path = require('path'), os = require('os'), { execFile } = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/samples'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kwg-'));
const BASE = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/';
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const note = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
// id: [GM-Name, tiefster Ton, höchster Ton, Länge in Sekunden]
const GM = {
  epiano: ['electric_piano_1', 36, 96, 3], honky: ['honkytonk_piano', 36, 96, 3], clavinet: ['clavinet', 36, 84, 2],
  celesta: ['celesta', 60, 96, 3], musicbox: ['music_box', 60, 96, 3], dulcimer: ['dulcimer', 48, 90, 3],
  drawbar: ['drawbar_organ', 36, 90, 2.5], rockorgan: ['rock_organ', 36, 90, 2.5], accordion: ['accordion', 41, 84, 2.5], bandoneon: ['tango_accordion', 41, 84, 2.5],
  'guitar-clean': ['electric_guitar_clean', 40, 84, 3], 'guitar-muted': ['electric_guitar_muted', 40, 84, 1.2],
  overdrive: ['overdriven_guitar', 40, 84, 2.5], distortion: ['distortion_guitar', 40, 84, 2.5], banjo: ['banjo', 48, 84, 2.5],
  acbass: ['acoustic_bass', 28, 60, 2.5], fretless: ['fretless_bass', 28, 60, 2.5], slap: ['slap_bass_1', 28, 60, 2], pickbass: ['electric_bass_pick', 28, 60, 2], synthbass: ['synth_bass_1', 28, 64, 2],
  viola: ['viola', 48, 84, 2.5], strings: ['string_ensemble_1', 36, 96, 3], tremolo: ['tremolo_strings', 36, 96, 2.5], pizz: ['pizzicato_strings', 36, 90, 1.5], synthstrings: ['synth_strings_1', 36, 96, 3],
  choir: ['choir_aahs', 48, 84, 3], oohs: ['voice_oohs', 48, 84, 3],
  brass: ['brass_section', 41, 84, 2.5], mutedtpt: ['muted_trumpet', 55, 84, 2.5], altosax: ['alto_sax', 49, 84, 2.5], barisax: ['baritone_sax', 36, 72, 2.5],
  oboe: ['oboe', 58, 91, 2.5], englhorn: ['english_horn', 52, 84, 2.5], piccolo: ['piccolo', 72, 100, 2.5], panflute: ['pan_flute', 60, 96, 2.5], shakuhachi: ['shakuhachi', 55, 90, 2.5],
  timpani: ['timpani', 38, 60, 3], orchhit: ['orchestra_hit', 48, 84, 1.5], steeldrum: ['steel_drums', 52, 88, 2.5],
  sitar: ['sitar', 48, 84, 3], koto: ['koto', 48, 84, 3], shamisen: ['shamisen', 48, 84, 2], bagpipe: ['bagpipe', 55, 80, 2.5], fiddle: ['fiddle', 55, 96, 2.5], shanai: ['shanai', 60, 90, 2.5],
  'pad-warm': ['pad_2_warm', 36, 90, 3], 'pad-halo': ['pad_7_halo', 36, 90, 3], 'pad-newage': ['pad_1_new_age', 36, 90, 3], crystal: ['fx_3_crystal', 48, 96, 3],
  // Neu in v1.3
  egrand: ['electric_grand_piano', 36, 96, 3], percorgan: ['percussive_organ', 36, 90, 2.5], harmonics: ['guitar_harmonics', 48, 84, 2.5],
  bottle: ['blown_bottle', 60, 90, 2.5], tinkle: ['tinkle_bell', 60, 96, 2.5], agogo: ['agogo', 52, 84, 1.5], taiko: ['taiko_drum', 36, 60, 2],
  woodblock: ['woodblock', 48, 84, 1], synthvox: ['synth_choir', 48, 84, 3],
  // Neu in v1.4: Synth-Leads, Flächen und Effektklänge
  'lead-square': ['lead_1_square', 48, 96, 2.5], 'lead-saw': ['lead_2_sawtooth', 48, 96, 2.5], calliope: ['lead_3_calliope', 48, 96, 2.5],
  chiff: ['lead_4_chiff', 48, 96, 2.5], charang: ['lead_5_charang', 40, 88, 2.5], 'lead-voice': ['lead_6_voice', 48, 90, 2.5],
  fifths: ['lead_7_fifths', 40, 88, 2.5], basslead: ['lead_8_bass__lead', 28, 72, 2.5], synthbass2: ['synth_bass_2', 28, 64, 2],
  synthbrass: ['synth_brass_1', 41, 84, 2.5], epiano2: ['electric_piano_2', 36, 96, 3],
  polysynth: ['pad_3_polysynth', 36, 90, 3], 'pad-bowed': ['pad_5_bowed', 36, 90, 3], 'pad-metal': ['pad_6_metallic', 36, 90, 3], 'pad-sweep': ['pad_8_sweep', 36, 90, 3],
  atmosphere: ['fx_4_atmosphere', 36, 90, 3], brightness: ['fx_5_brightness', 36, 90, 3], echoes: ['fx_7_echoes', 36, 90, 3], scifi: ['fx_8_scifi', 36, 90, 3]
};
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 1 << 26 }, (e, so) => e ? rej(e) : res(so)));
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
async function sample(id, gm, m, dur) {
  const raw = path.join(tmp, `${id}-${m}.mp3`), enc = path.join(tmp, `${id}-${m}-e.mp3`);
  for (let i = 0; ; i++) {
    try { await run('curl', ['-sfL', '--max-time', '60', '-o', raw, `${BASE}${gm}-mp3/${note(m)}.mp3`]); break; }
    catch (e) { if (i > 3) throw new Error('Download fehlgeschlagen: ' + gm + ' ' + note(m)); }
  }
  // Mono, Stille vorne weg, auf Länge kürzen und ausblenden
  await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', `silenceremove=start_periods=1:start_threshold=-60dB,atrim=0:${dur},afade=t=out:st=${dur - .25}:d=0.25`, '-ac', '1', '-ar', '44100', '-b:a', '56k', enc]);
  const b = fs.readFileSync(enc).toString('base64'); fs.rmSync(raw); fs.rmSync(enc); return b;
}
const pick = new Set((process.argv[2] || '').split(',').filter(Boolean));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await pool(Object.entries(GM).filter(([id]) => !pick.size || pick.has(id)), 4, async ([id, [gm, lo, hi, dur]]) => {
    const data = {};
    for (let m = lo; m <= hi; m += 4) data[m] = await sample(id, gm, m, dur);
    fs.writeFileSync(path.join(out, 'gm-' + id + '.js'), `KW_SMP(${JSON.stringify('gm-' + id)},${JSON.stringify(data)});\n`);
    console.log('gm-' + id, Object.keys(data).length, 'Töne');
  });
  fs.rmSync(tmp, { recursive: true });
})().catch(e => { console.error(e.message); process.exit(1); });
