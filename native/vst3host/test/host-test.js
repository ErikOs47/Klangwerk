// Prüft sg-vst3host mit den Test-Plugins: Laden, Noten -> Klang, Effekt, Zustand, Editor, Absturzschutz.
// Aufruf (Linux mit Wine): node native/vst3host/test/host-test.js <host.exe> <testplug.vst3 als Windows-Pfad>
// Unter Windows läuft der Host direkt (so in der GitHub-Action).
const { spawn } = require('child_process');
const [exe, plug] = process.argv.slice(2);
const runner = process.platform === 'win32' ? '' : process.env.HOST_RUNNER ?? 'wine';
const SR = 48000, N = 128;

function start(cid) {
  const args = [exe, '--run', plug, '--cid', cid, '--sr', String(SR), '--token', 'abc123', '--title', 'Test'];
  const p = runner ? spawn(runner, args) : spawn(args[0], args.slice(1));
  let buf = '', waiters = [], events = [];
  p.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); if (!l.startsWith('- ') && waiters.length) waiters.shift()(l); else events.push(l); }
  });
  let n = 0;
  const line = () => new Promise(r => waiters.push(r));
  const cmd = async (c) => { const id = ++n; p.stdin.write(`${id} ${c}\n`); return line(); };
  return { p, line, cmd, events };
}
function packet(seq, nIn, input, evs, flags = 1) {
  const b = new ArrayBuffer(40 + evs.length * 8 + nIn * N * 4), v = new DataView(b);
  v.setUint32(0, seq, true); v.setUint16(4, N, true); v.setUint8(6, nIn); v.setUint8(7, flags);
  v.setFloat64(8, 120, true); v.setFloat64(16, seq * N / SR * 2, true); v.setFloat64(24, seq * N, true);
  v.setUint16(32, evs.length, true); v.setUint8(34, 4); v.setUint8(35, 4);
  evs.forEach(([o, s, d1, d2], i) => { v.setUint16(40 + i * 8, o, true); v.setUint8(42 + i * 8, s); v.setUint8(43 + i * 8, d1); v.setUint8(44 + i * 8, d2); });
  if (nIn) new Float32Array(b, 40 + evs.length * 8).set(input);
  return b;
}
const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
function ws(port) {
  return new Promise((res, rej) => {
    const w = new WebSocket(`ws://127.0.0.1:${port}/abc123`); w.binaryType = 'arraybuffer';
    const q = []; w.onmessage = e => q.shift()?.(e.data);
    w.onopen = () => res({ send: b => new Promise(r => { q.push(r); w.send(b); }), close: () => w.close() });
    w.onerror = rej;
  });
}
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

(async () => {
  // Instrument
  const s = start('5347A001111122223333444455556666');
  const ready = JSON.parse(await s.line());
  ok(ready.ready && ready.inst && ready.outs === 2 && ready.editor, 'Synth geladen: ' + JSON.stringify(ready));
  const c = await ws(ready.port);
  let r = await c.send(packet(0, 0, null, []));
  let out = new Float32Array(r, 8);
  ok(new DataView(r).getUint32(0, true) === 0 && rms(out) === 0, 'Stille ohne Note');
  r = await c.send(packet(1, 0, null, [[0, 0x90, 69, 127]]));
  out = new Float32Array(r, 8);
  ok(Math.abs(rms(out.subarray(0, N)) - 0.5 / Math.SQRT2) < 0.05, 'Note an -> Sinus, RMS ' + rms(out.subarray(0, N)).toFixed(3));
  // Lauter per Zustand: 0.5 -> 1.0
  const st = await s.cmd('getstate');
  ok(/^\d+ ok \S+/.test(st), 'Zustand gelesen');
  const blob = Buffer.from(st.split(' ')[2], 'base64'); blob.writeDoubleLE(1.0, 8);
  ok((await s.cmd('setstate ' + blob.toString('base64'))).endsWith('ok'), 'Zustand gesetzt');
  r = await c.send(packet(2, 0, null, []));
  ok(Math.abs(rms(new Float32Array(r, 8, N)) - 1 / Math.SQRT2) < 0.05, 'Zustand wirkt: RMS ' + rms(new Float32Array(r, 8, N)).toFixed(3));
  r = await c.send(packet(3, 0, null, [], 1 | 2));
  ok(rms(new Float32Array(r, 8)) === 0, 'Alle Noten aus');
  // Pakete schnell hintereinander (wie ein Audio-Puffer)
  const t0 = performance.now(); const all = [];
  for (let i = 0; i < 400; i++) all.push(c.send(packet(10 + i, 0, null, i === 0 ? [[5, 0x90, 60, 100]] : [])));
  await Promise.all(all);
  ok(true, `400 Blöcke in ${(performance.now() - t0).toFixed(0)} ms (Echtzeit wären ${(400 * N / SR * 1000).toFixed(0)} ms)`);
  if (process.env.DISPLAY || process.platform === 'win32') {
    ok((await s.cmd('edit')).endsWith('ok'), 'Editor geöffnet');
    await new Promise(r => setTimeout(r, 800));
    ok((await s.cmd('close')).endsWith('ok'), 'Editor geschlossen');
  }
  c.close();
  ok((await s.cmd('quit')).endsWith('ok'), 'Beendet');

  // Effekt
  const g = start('5347A002111122223333444455556666');
  const gr = JSON.parse(await g.line());
  ok(gr.ready && !gr.inst && gr.ins === 2, 'Gain geladen');
  const gc = await ws(gr.port);
  const inp = new Float32Array(2 * N).fill(0.25);
  r = await gc.send(packet(0, 2, inp, []));
  ok(Math.abs(new Float32Array(r, 8)[5] - 0.25) < 1e-6, 'Gain 0,5 -> Signal unverändert (×1)');
  // Falscher Token wird abgewiesen
  const bad = await new Promise(res => { const w = new WebSocket(`ws://127.0.0.1:${gr.port}/falsch`); w.onopen = () => res(false); w.onerror = () => res(true); });
  ok(bad, 'Falscher Token abgewiesen');
  gc.close(); g.p.stdin.end();
  const code = await new Promise(r => g.p.on('exit', r));
  ok(code === 0, 'Host endet, wenn Sound Groot weg ist (stdin zu)');
  // Unbekanntes Plugin
  const b = start('00000000000000000000000000000000');
  ok(JSON.parse(await b.line()).error, 'Fehlende Klasse meldet Fehler');
})();
