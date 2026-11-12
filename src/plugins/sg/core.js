// Sound-Groot-Effekte: 13 Effekt-Plugins, die ohne Internet überall laufen (Windows-App, Browser, iPhone, Export).
// Jeder Effekt rechnet im Audio-Thread (AudioWorklet) und bietet nach außen dieselbe Schnittstelle wie ein
// Web Audio Module 2.0: createInstance, audioNode mit getState/setState, Parameterliste, Automation, createGui.
// Lizenz: MIT, wie Sound Groot selbst. Hall nach dem gemeinfreien Freeverb-Aufbau (Jezar).

// Parameter: [id, Name, kleinster Wert, größter Wert, Standard, Einheit, 'log' für Frequenzen und Zeiten]
export const FX = {
  chorus: { name: 'Chorus', desc: 'Macht aus einer Stimme mehrere: breiter, schwebender Klang für Gitarren, Flächen und Gesang', p: [
    ['rate', 'Tempo', .1, 6, .8, 'Hz', 'log'], ['depth', 'Tiefe', 0, 100, 45, '%'], ['mix', 'Mix', 0, 100, 50, '%']] },
  flanger: { name: 'Flanger', desc: 'Der „Düsenjet“-Effekt: ein kurzes, wanderndes Echo mit Rückkopplung', p: [
    ['rate', 'Tempo', .05, 5, .3, 'Hz', 'log'], ['depth', 'Tiefe', 0, 100, 70, '%'], ['fb', 'Rückkopplung', 0, 90, 55, '%'], ['mix', 'Mix', 0, 100, 50, '%']] },
  phaser: { name: 'Phaser', desc: 'Wandernde Kerben im Klang, weich und kreisend. Klassiker auf E-Piano und Gitarre', p: [
    ['rate', 'Tempo', .05, 5, .4, 'Hz', 'log'], ['depth', 'Tiefe', 0, 100, 70, '%'], ['fb', 'Rückkopplung', 0, 90, 40, '%'], ['mix', 'Mix', 0, 100, 100, '%']] },
  tremolo: { name: 'Tremolo & Auto-Pan', desc: 'Lautstärke schwingt auf und ab. Mit „Stereo“ wandert der Klang zwischen links und rechts', p: [
    ['rate', 'Tempo', .2, 16, 5, 'Hz', 'log'], ['depth', 'Tiefe', 0, 100, 60, '%'], ['shape', 'Härte', 0, 100, 0, '%'], ['stereo', 'Stereo', 0, 100, 0, '%']] },
  crusher: { name: 'Bitcrusher', desc: 'Lo-Fi wie bei alten Samplern: weniger Bits und eine niedrigere Abtastrate', p: [
    ['bits', 'Bits', 2, 16, 8, 'Bit'], ['rate', 'Abtastrate', 500, 44100, 11025, 'Hz', 'log'], ['mix', 'Mix', 0, 100, 100, '%']] },
  wah: { name: 'Auto-Wah', desc: 'Ein Filter, das sich mit der Spielstärke öffnet: funky auf Gitarre, Clavinet und Bass', p: [
    ['sens', 'Empfindlichkeit', 0, 100, 60, '%'], ['freq', 'Grundton', 150, 2000, 350, 'Hz', 'log'], ['q', 'Resonanz', 1, 12, 5, ''], ['mix', 'Mix', 0, 100, 100, '%']] },
  width: { name: 'Stereo-Breite', desc: 'Macht das Stereobild breiter oder schmaler; tiefe Töne bleiben auf Wunsch in der Mitte', p: [
    ['width', 'Breite', 0, 200, 140, '%'], ['mono', 'Bass mono unter', 0, 300, 120, 'Hz'], ['bal', 'Balance', -100, 100, 0, '%']] },
  limiter: { name: 'Limiter', desc: 'Macht lauter und fängt Spitzen ab, ohne dass es übersteuert. Gut als letztes Plugin der Kette', p: [
    ['gain', 'Anheben', 0, 24, 6, 'dB'], ['ceil', 'Obergrenze', -12, 0, -1, 'dB'], ['rel', 'Erholung', 10, 500, 120, 'ms', 'log']] },
  plate: { name: 'Plattenhall', desc: 'Dichter, heller Hall direkt auf der Spur (zusätzlich zum gemeinsamen Hall im Mixer)', p: [
    ['size', 'Größe', 0, 100, 60, '%'], ['damp', 'Dämpfung', 0, 100, 35, '%'], ['pre', 'Vorverzögerung', 0, 150, 15, 'ms'], ['mix', 'Mix', 0, 100, 25, '%']] },
  tape: { name: 'Bandsättigung', desc: 'Wärme und sanfte Verzerrung wie von einer Bandmaschine', p: [
    ['drive', 'Sättigung', 0, 30, 9, 'dB'], ['tone', 'Höhen', 1500, 20000, 12000, 'Hz', 'log'], ['out', 'Ausgang', -18, 6, -3, 'dB'], ['mix', 'Mix', 0, 100, 100, '%']] },
  gate: { name: 'Noise Gate', desc: 'Schaltet stumm, wenn nichts gespielt wird: entfernt Rauschen und Nebengeräusche aus Aufnahmen', p: [
    ['thr', 'Schwelle', -70, -10, -45, 'dB'], ['rel', 'Ausklang', 20, 800, 150, 'ms', 'log'], ['floor', 'Absenkung', -80, 0, -80, 'dB']] },
  lofi: { name: 'Lo-Fi (Vinyl)', desc: 'Leiern, Rauschen und Knistern wie von einer alten Platte', p: [
    ['wow', 'Leiern', 0, 100, 35, '%'], ['hiss', 'Rauschen', 0, 100, 20, '%'], ['crackle', 'Knistern', 0, 100, 25, '%'], ['tone', 'Höhen', 1000, 16000, 6000, 'Hz', 'log']] },
  transient: { name: 'Transienten', desc: 'Betont oder zähmt den Anschlag und den Ausklang, vor allem bei Drums', p: [
    ['att', 'Anschlag', -100, 100, 40, '%'], ['sus', 'Ausklang', -100, 100, 0, '%'], ['out', 'Ausgang', -12, 12, 0, 'dB']] }
};

// ---------------------------------------------------------------- Rechnen im Audio-Thread
const PROCESSOR = String.raw`
const TAU = 2 * Math.PI, ZERO = new Float32Array(128);
const db = x => Math.pow(10, x / 20);
// Jeder Effekt: (Abtastrate) => (L, R, outL, outR, n, v) mit v = aktuelle Parameterwerte in der Reihenfolge der Liste
const MAKE = {
  chorus(sr) {
    const N = 4096, bl = new Float32Array(N), br = new Float32Array(N); let w = 0, ph = 0;
    const tap = (b, d) => { const p = w - d + N, i = Math.floor(p), f = p - i; return b[i & (N - 1)] * (1 - f) + b[(i + 1) & (N - 1)] * f; };
    return (L, R, oL, oR, n, v) => {
      const inc = TAU * v[0] / sr, dep = v[1] / 100 * .006 * sr, base = .018 * sr, mix = v[2] / 100;
      for (let i = 0; i < n; i++) {
        bl[w] = L[i]; br[w] = R[i];
        const a = tap(bl, base + dep * Math.sin(ph)), b = tap(br, base + dep * Math.sin(ph + 1.9));
        oL[i] = L[i] * (1 - mix * .5) + a * mix; oR[i] = R[i] * (1 - mix * .5) + b * mix;
        w = (w + 1) & (N - 1); ph += inc; if (ph > TAU) ph -= TAU;
      }
    };
  },
  flanger(sr) {
    const N = 2048, bl = new Float32Array(N), br = new Float32Array(N); let w = 0, ph = 0, fl = 0, fr = 0;
    const tap = (b, d) => { const p = w - d + N, i = Math.floor(p), f = p - i; return b[i & (N - 1)] * (1 - f) + b[(i + 1) & (N - 1)] * f; };
    return (L, R, oL, oR, n, v) => {
      const inc = TAU * v[0] / sr, dep = v[1] / 100 * .004 * sr, fb = v[2] / 100, mix = v[3] / 100, base = .0006 * sr;
      for (let i = 0; i < n; i++) {
        bl[w] = L[i] * (1 - fb * .35) + fl * fb; br[w] = R[i] * (1 - fb * .35) + fr * fb;
        fl = tap(bl, base + dep * (.5 + .5 * Math.sin(ph))); fr = tap(br, base + dep * (.5 + .5 * Math.sin(ph + .6)));
        oL[i] = L[i] + (fl - L[i] * .3) * mix; oR[i] = R[i] + (fr - R[i] * .3) * mix;
        w = (w + 1) & (N - 1); ph += inc; if (ph > TAU) ph -= TAU;
      }
    };
  },
  phaser(sr) {
    const S = 6, xl = new Float32Array(S), yl = new Float32Array(S), xr = new Float32Array(S), yr = new Float32Array(S); let ph = 0, fl = 0, fr = 0, a = 0, a2 = 0, k = 0;
    return (L, R, oL, oR, n, v) => {
      const inc = TAU * v[0] / sr, dep = v[1] / 100, fb = v[2] / 100 * .9, mix = v[3] / 100 * .5;
      for (let i = 0; i < n; i++) {
        if ((k++ & 15) === 0) {
          const f1 = 300 * Math.pow(2, dep * 3.2 * (.5 + .5 * Math.sin(ph))), f2 = 300 * Math.pow(2, dep * 3.2 * (.5 + .5 * Math.sin(ph + .9)));
          let t = Math.tan(Math.PI * Math.min(f1, sr * .45) / sr); a = (t - 1) / (t + 1);
          t = Math.tan(Math.PI * Math.min(f2, sr * .45) / sr); a2 = (t - 1) / (t + 1);
        }
        let l = L[i] + fl * fb, r = R[i] + fr * fb;
        for (let s = 0; s < S; s++) {
          let y = a * l + xl[s] - a * yl[s]; xl[s] = l; yl[s] = y; l = y;
          y = a2 * r + xr[s] - a2 * yr[s]; xr[s] = r; yr[s] = y; r = y;
        }
        fl = l; fr = r;
        oL[i] = L[i] + (l - L[i]) * mix; oR[i] = R[i] + (r - R[i]) * mix;
        ph += inc; if (ph > TAU) ph -= TAU;
      }
    };
  },
  tremolo(sr) {
    let ph = 0;
    return (L, R, oL, oR, n, v) => {
      const inc = TAU * v[0] / sr, dep = v[1] / 100, hard = 1 + v[2] / 100 * 12, norm = 1 / Math.tanh(hard), off = Math.PI * v[3] / 100;
      for (let i = 0; i < n; i++) {
        const a = Math.tanh(Math.sin(ph) * hard) * norm, b = Math.tanh(Math.sin(ph + off) * hard) * norm;
        oL[i] = L[i] * (1 - dep * (.5 + .5 * a)); oR[i] = R[i] * (1 - dep * (.5 + .5 * b));
        ph += inc; if (ph > TAU) ph -= TAU;
      }
    };
  },
  crusher(sr) {
    let acc = 1, hl = 0, hr = 0;
    return (L, R, oL, oR, n, v) => {
      const q = Math.pow(2, Math.round(v[0]) - 1), step = Math.min(1, v[1] / sr), mix = v[2] / 100;
      for (let i = 0; i < n; i++) {
        acc += step;
        if (acc >= 1) { acc -= 1; hl = Math.round(L[i] * q) / q; hr = Math.round(R[i] * q) / q; }
        oL[i] = L[i] + (hl - L[i]) * mix; oR[i] = R[i] + (hr - R[i]) * mix;
      }
    };
  },
  wah(sr) {
    let env = 0, g = .05, k = 0, l1 = 0, l2 = 0, r1 = 0, r2 = 0;
    const up = 1 - Math.exp(-1 / (.004 * sr)), down = 1 - Math.exp(-1 / (.12 * sr));
    return (L, R, oL, oR, n, v) => {
      const sens = v[0] / 100 * 4.5, damp = 1 / v[2], mix = v[3] / 100, boost = 1 + v[2] * .06;
      for (let i = 0; i < n; i++) {
        const x = Math.max(Math.abs(L[i]), Math.abs(R[i])); env += (x - env) * (x > env ? up : down);
        if ((k++ & 7) === 0) g = Math.tan(Math.PI * Math.min(v[1] * Math.pow(2, Math.min(1, env * 3) * sens), sr * .45) / sr);
        const a1 = 1 / (1 + g * (g + damp)), a2 = g * a1, a3 = g * a2;
        let v3 = L[i] - l2, v1 = a1 * l1 + a2 * v3, v2 = l2 + a2 * l1 + a3 * v3; l1 = 2 * v1 - l1; l2 = 2 * v2 - l2;
        oL[i] = L[i] + (v1 * boost - L[i]) * mix;
        v3 = R[i] - r2; v1 = a1 * r1 + a2 * v3; v2 = r2 + a2 * r1 + a3 * v3; r1 = 2 * v1 - r1; r2 = 2 * v2 - r2;
        oR[i] = R[i] + (v1 * boost - R[i]) * mix;
      }
    };
  },
  width(sr) {
    let lp = 0;
    return (L, R, oL, oR, n, v) => {
      const w = v[0] / 100, c = v[1] > 1 ? 1 - Math.exp(-TAU * v[1] / sr) : 0, b = v[2] / 100, gl = b > 0 ? 1 - b : 1, gr = b < 0 ? 1 + b : 1;
      for (let i = 0; i < n; i++) {
        const m = (L[i] + R[i]) * .5; let s = (L[i] - R[i]) * .5;
        if (c) { lp += (s - lp) * c; s -= lp; }
        s *= w; oL[i] = (m + s) * gl; oR[i] = (m - s) * gr;
      }
    };
  },
  limiter(sr) {
    const D = Math.max(8, Math.round(.005 * sr)), bl = new Float32Array(D), br = new Float32Array(D); let w = 0, g = 1, hold = 0, peak = 0;
    const atk = 1 - Math.exp(-1 / (.0012 * sr));
    return (L, R, oL, oR, n, v) => {
      const gain = db(v[0]), ceil = db(v[1]), rel = 1 - Math.exp(-1 / (v[2] / 1000 * sr));
      for (let i = 0; i < n; i++) {
        const l = L[i] * gain, r = R[i] * gain, x = Math.max(Math.abs(l), Math.abs(r));
        // Spitze über die Vorausschau halten, damit die Absenkung rechtzeitig da ist
        if (x >= peak) { peak = x; hold = D; } else if (--hold <= 0) peak += (x - peak) * rel;
        const t = peak > ceil ? ceil / peak : 1;
        g += (t - g) * (t < g ? atk : rel);
        const dl = bl[w], dr = br[w]; bl[w] = l; br[w] = r; w = (w + 1) % D;
        oL[i] = Math.max(-ceil, Math.min(ceil, dl * g)); oR[i] = Math.max(-ceil, Math.min(ceil, dr * g));
      }
    };
  },
  plate(sr) {
    const k = sr / 44100, CT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AT = [556, 441, 341, 225];
    const mk = (list, add) => list.map(t => ({ b: new Float32Array(Math.round((t + add) * k)), i: 0, f: 0 }));
    const cl = mk(CT, 0), cr = mk(CT, 23), al = mk(AT, 0), ar = mk(AT, 23);
    const PN = Math.ceil(.16 * sr), pb = new Float32Array(PN); let pw = 0;
    const run = (combs, aps, x, fb, d1, d2) => {
      let o = 0;
      for (const c of combs) { const y = c.b[c.i]; c.f = y * d2 + c.f * d1; c.b[c.i] = x + c.f * fb; if (++c.i >= c.b.length) c.i = 0; o += y; }
      for (const a of aps) { const y = a.b[a.i]; a.b[a.i] = o + y * .5; if (++a.i >= a.b.length) a.i = 0; o = y - o; }
      return o;
    };
    return (L, R, oL, oR, n, v) => {
      const fb = .7 + v[0] / 100 * .28, d1 = v[1] / 100 * .4, d2 = 1 - d1, pre = Math.min(PN - 1, Math.round(v[2] / 1000 * sr)), mix = v[3] / 100;
      for (let i = 0; i < n; i++) {
        pb[pw] = (L[i] + R[i]) * .015; const x = pb[(pw - pre + PN) % PN]; pw = (pw + 1) % PN;
        const a = run(cl, al, x, fb, d1, d2), b = run(cr, ar, x, fb, d1, d2);
        oL[i] = L[i] * (1 - mix) + a * 2.2 * mix; oR[i] = R[i] * (1 - mix) + b * 2.2 * mix;
      }
    };
  },
  tape(sr) {
    let ll = 0, lr = 0;
    return (L, R, oL, oR, n, v) => {
      const g = db(v[0]), c = 1 - Math.exp(-TAU * Math.min(v[1], sr * .45) / sr), out = db(v[2]), mix = v[3] / 100, norm = 1 / Math.tanh(Math.max(1, g * .5)), bias = Math.tanh(.08);
      for (let i = 0; i < n; i++) {
        ll += ((Math.tanh(L[i] * g + .08) - bias) * norm - ll) * c; lr += ((Math.tanh(R[i] * g + .08) - bias) * norm - lr) * c;
        oL[i] = L[i] + (ll * out - L[i]) * mix; oR[i] = R[i] + (lr * out - R[i]) * mix;
      }
    };
  },
  gate(sr) {
    let env = 0, g = 0, open = false, hold = 0;
    const er = Math.exp(-1 / (.03 * sr)), atk = 1 - Math.exp(-1 / (.001 * sr)), H = Math.round(.04 * sr);
    return (L, R, oL, oR, n, v) => {
      const on = db(v[0]), off = on * .5, rel = 1 - Math.exp(-1 / (v[1] / 1000 * sr)), fl = v[2] <= -79.5 ? 0 : db(v[2]);
      for (let i = 0; i < n; i++) {
        const x = Math.max(Math.abs(L[i]), Math.abs(R[i])); env = x > env ? x : env * er;
        if (env > on) { open = true; hold = H; } else if (env < off && open && --hold <= 0) open = false;
        const t = open ? 1 : fl; g += (t - g) * (t > g ? atk : rel);
        oL[i] = L[i] * g; oR[i] = R[i] * g;
      }
    };
  },
  lofi(sr) {
    const N = 2048, bl = new Float32Array(N), br = new Float32Array(N); let w = 0, p1 = 0, p2 = 0, ll = 0, lr = 0, hn = 0, ck = 0, seed = 22222;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const tap = (b, d) => { const p = w - d + N, i = Math.floor(p), f = p - i; return b[i & (N - 1)] * (1 - f) + b[(i + 1) & (N - 1)] * f; };
    return (L, R, oL, oR, n, v) => {
      const wow = v[0] / 100, hiss = v[1] / 100 * .02, cr = v[2] / 100, c = 1 - Math.exp(-TAU * Math.min(v[3], sr * .45) / sr), i1 = TAU * .55 / sr, i2 = TAU * 6.3 / sr;
      for (let i = 0; i < n; i++) {
        bl[w] = L[i]; br[w] = R[i];
        const d = 8 + wow * (.0035 * sr * (.5 + .5 * Math.sin(p1)) + .0004 * sr * (.5 + .5 * Math.sin(p2)));
        hn += ((rnd() * 2 - 1) - hn) * .35;
        if (rnd() < cr * 6 / sr * 8) ck = (rnd() * 2 - 1) * .5; else ck *= .7;
        const noise = hn * hiss + ck * cr * .35;
        ll += (Math.tanh(tap(bl, d) * 1.2) + noise - ll) * c; lr += (Math.tanh(tap(br, d) * 1.2) + noise - lr) * c;
        oL[i] = ll; oR[i] = lr;
        w = (w + 1) & (N - 1); p1 += i1; if (p1 > TAU) p1 -= TAU; p2 += i2; if (p2 > TAU) p2 -= TAU;
      }
    };
  },
  transient(sr) {
    let f = 0, s = 0;
    const fa = 1 - Math.exp(-1 / (.001 * sr)), fr = 1 - Math.exp(-1 / (.03 * sr)), sa = 1 - Math.exp(-1 / (.025 * sr)), srl = 1 - Math.exp(-1 / (.25 * sr));
    return (L, R, oL, oR, n, v) => {
      const a = v[0] / 100 * 9, su = v[1] / 100 * 9, out = db(v[2]);
      for (let i = 0; i < n; i++) {
        const x = (Math.abs(L[i]) + Math.abs(R[i])) * .5;
        f += (x - f) * (x > f ? fa : fr); s += (x - s) * (x > s ? sa : srl);
        const d = (f - s) / (f + s + 1e-5), g = Math.pow(10, (d > 0 ? a * d : -su * d) / 20) * out;
        oL[i] = L[i] * g; oR[i] = R[i] * g;
      }
    };
  }
};
class SgFx extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = o.processorOptions; this.v = p.values.slice(); this.q = []; this.alive = true; this.fx = MAKE[p.type](sampleRate);
    this.port.onmessage = e => {
      const d = e.data;
      if (d.set) this.v[d.set[0]] = d.set[1];
      if (d.all) this.v = d.all.slice();
      if (d.at) for (const x of d.at) this.q.push(x);
      if (d.clear) this.q.length = 0;
      if (d.end) this.alive = false;
    };
  }
  process(inputs, outputs) {
    const out = outputs[0], inp = inputs[0], n = out[0].length;
    if (this.q.length) { const end = currentFrame + n; let k = 0; for (const e of this.q) { if (e[0] < end) this.v[e[1]] = e[2]; else this.q[k++] = e; } this.q.length = k; }
    const L = inp[0] || (n === 128 ? ZERO : new Float32Array(n)), R = inp[1] || L;
    this.fx(L, R, out[0], out[1] || out[0], n, this.v);
    return this.alive;
  }
}
registerProcessor('sg-fx', SgFx);
`;

// ---------------------------------------------------------------- Plugin für die App
const loaded = new WeakMap();
function loadProcessor(ctx) {
  let p = loaded.get(ctx);
  if (!p) { p = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([PROCESSOR], { type: 'text/javascript' }))); p.catch(() => loaded.delete(ctx)); loaded.set(ctx, p); }
  return p;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Regler 0…1 ↔ echter Wert (Frequenzen und Zeiten laufen logarithmisch, das fühlt sich gleichmäßig an)
const toReal = (s, x) => s[6] === 'log' ? s[2] * Math.pow(s[3] / s[2], clamp(x, 0, 1)) : s[2] + clamp(x, 0, 1) * (s[3] - s[2]);
const toNorm = (s, v) => s[6] === 'log' ? Math.log(clamp(v, s[2], s[3]) / s[2]) / Math.log(s[3] / s[2]) : (clamp(v, s[2], s[3]) - s[2]) / (s[3] - s[2]);
const fmt = (s, v) => {
  const a = Math.abs(v), t = s[5] === 'Hz' && a >= 1000 ? (v / 1000).toFixed(a >= 10000 ? 0 : 1) + ' k' : a >= 100 || s[5] === '%' || s[5] === 'Bit' || s[5] === 'ms' ? String(Math.round(v)) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  return t.replace('.', ',') + (s[5] ? (t.endsWith('k') ? '' : ' ') + s[5] : '');
};
let styled = false;
function style() {
  if (styled) return; styled = true;
  const st = document.createElement('style');
  st.textContent = `.sgfx{box-sizing:border-box;width:min(340px,86vw);padding:14px 16px 16px;background:#15171c;color:#eceef3;font:13px/1.4 Inter,"Segoe UI",system-ui,sans-serif}
.sgfx h4{margin:0 0 2px;font-size:14px;font-weight:600}.sgfx p{margin:0 0 12px;font-size:12px;color:#8b91a1;line-height:1.45}
.sgfx label{display:grid;grid-template-columns:104px 1fr 62px;align-items:center;gap:10px;margin:7px 0;font-size:12px;color:#b9bdc8}
.sgfx input{width:100%;min-width:0;margin:0}.sgfx output{text-align:right;color:#eceef3;font-variant-numeric:tabular-nums}
.sgfx button{margin-top:10px;height:28px;padding:0 12px;border-radius:8px;border:1px solid #2b2f38;background:#252931;color:#eceef3;font:inherit;font-size:12px;cursor:pointer}`;
  document.head.appendChild(st);
}

export function plugin(type) {
  const def = FX[type];
  return class SgPlugin {
    static isWebAudioModuleConstructor = true;
    static async createInstance(groupId, ctx, state) {
      await loadProcessor(ctx);
      const P = def.p, vals = P.map(s => s[4]);
      const node = new AudioWorkletNode(ctx, 'sg-fx', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit', processorOptions: { type, values: vals } });
      const guis = new Set();
      const show = i => { for (const g of guis) g.sgSync?.(i); };
      const idx = id => P.findIndex(s => s[0] === String(id));
      const set = (i, v) => { vals[i] = clamp(v, P[i][2], P[i][3]); node.port.postMessage({ set: [i, vals[i]] }); };
      node.getParameterInfo = async () => Object.fromEntries(P.map(s => [s[0], { id: s[0], label: s[1], units: s[5], minValue: s[2], maxValue: s[3], defaultValue: s[4] }]));
      node.getParameterValues = async normalized => Object.fromEntries(P.map((s, i) => [s[0], { id: s[0], value: normalized ? toNorm(s, vals[i]) : vals[i], normalized: !!normalized }]));
      node.setParameterValues = async o => { for (const k in o) { const i = idx(k); if (i >= 0) { set(i, o[k].normalized ? toReal(P[i], o[k].value) : o[k].value); show(i); } } };
      // Automation mit genauer Zeit: Werte kommen normiert (0…1) und gelten ab ihrem Zeitpunkt im Audio-Thread
      node.scheduleEvents = (...evs) => {
        const at = [];
        for (const e of evs) if (e.type === 'wam-automation') { const i = idx(e.data.id); if (i < 0) continue; const v = e.data.normalized === false ? e.data.value : toReal(P[i], e.data.value); vals[i] = v; at.push([Math.round((e.time ?? ctx.currentTime) * ctx.sampleRate), i, v]); show(i); }
        if (at.length) node.port.postMessage({ at });
      };
      node.clearEvents = () => node.port.postMessage({ clear: 1 });
      node.getState = async () => ({ sg: 1, v: Object.fromEntries(P.map((s, i) => [s[0], vals[i]])) });
      node.setState = async st => { if (!st?.v) return; P.forEach((s, i) => { if (typeof st.v[s[0]] === 'number') vals[i] = clamp(st.v[s[0]], s[2], s[3]); }); node.port.postMessage({ all: vals }); show(-1); };
      node.destroy = () => { try { node.port.postMessage({ end: 1 }); } catch (e) { } };
      if (state) await node.setState(state);
      const inst = {
        audioNode: node, descriptor: { name: def.name, vendor: 'Sound Groot', isInstrument: false, description: def.desc },
        async createGui() {
          style();
          const el = document.createElement('div'); el.className = 'sgfx';
          el.innerHTML = `<h4>${def.name}</h4><p>${def.desc}</p>` + P.map((s, i) => `<label><span>${s[1]}</span><input type="range" min="0" max="1" step="0.001" data-i="${i}" aria-label="${s[1]}"><output></output></label>`).join('') + '<button type="button">Zurücksetzen</button>';
          const rows = [...el.querySelectorAll('label')];
          el.sgSync = k => rows.forEach((r, i) => { if (k >= 0 && k !== i) return; if (document.activeElement !== r.children[1] || k < 0) r.children[1].value = toNorm(P[i], vals[i]); r.children[2].textContent = fmt(P[i], vals[i]); });
          el.oninput = e => { const i = +e.target.dataset.i; if (!(i >= 0)) return; set(i, toReal(P[i], +e.target.value)); rows[i].children[2].textContent = fmt(P[i], vals[i]); };
          el.querySelector('button').onclick = () => { P.forEach((s, i) => set(i, s[4])); el.sgSync(-1); };
          // Doppelklick auf einen Regler setzt nur diesen zurück
          el.ondblclick = e => { const i = +e.target.dataset?.i; if (i >= 0) { set(i, P[i][4]); el.sgSync(i); } };
          el.sgSync(-1); guis.add(el);
          return el;
        },
        destroyGui(el) { guis.delete(el); }
      };
      return inst;
    }
  };
}
