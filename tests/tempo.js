// Tempowechsel im Song: Bedienung über das Lineal, samplegenauer Export, Abspielen, Rückgängig, MIDI hin und zurück, Audio, das dem Tempo folgt
const fs = require('fs'); const D = __dirname + '/out/';
function wav(file) {
  const b = fs.readFileSync(file); let o = 12, ch = 2, data = null;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') ch = b.readUInt16LE(o + 10); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  const N = data.length / 4 / ch, x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = data.readFloatLE(i * 4 * ch); return x;
}
// Erster Sample eines Schlags nahe der erwarteten Stelle (nach Stille): Schwelle 0,01
function onsetNear(x, at) { for (let i = Math.max(0, at - 800); i < at + 800; i++) if (Math.abs(x[i]) > .01) return i; return -1; }
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const step = async (name, f) => { try { await f(); } catch (e) { console.log('STEP FEHLER', name, e.message.split('\n').slice(0, 3).join(' | ')); } };
  const exp = async name => { await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav32'); await p.locator('#xNorm').selectOption('off'); const dl = p.waitForEvent('download', { timeout: 60000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + name); await p.waitForTimeout(400); return wav(D + name); };
  const barX = async n => { const r = await p.locator('#ruler').boundingBox(); return p.evaluate(b => { const e = [...document.querySelectorAll('.ruler .bn')].find(e => +e.dataset.b === b); return e ? e.getBoundingClientRect().left + 3 : null; }, n).then(x => [x, r.y + 20]); };
  // Tempowechsel über das Lineal-Menü setzen (Rechtsklick auf den Takt, dann Eingabe)
  const tempoAtBar = async (n, bpm) => {
    const [x, y] = await barX(n); await p.mouse.click(x, y, { button: 'right' });
    await p.locator('#ctxMenu button', { hasText: /Tempowechsel hier setzen|Tempo ändern/ }).click();
    await p.locator('#askIn').fill(String(bpm)); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.fill('#bpm', '120'); await p.keyboard.press('Enter');
  const hw = await p.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right), lane = await p.locator('.lane[data-track]').first().boundingBox();
  await p.mouse.dblclick(hw + 10, lane.y + 30); await p.waitForTimeout(400);
  await p.locator('#patsel').selectOption('Leer'); await p.waitForTimeout(300);
  await p.locator(`.cell[data-d="kick"][data-k="0"]`).click(); // ein Schlag pro Takt: kein Überlappen, jeder Anfang ist klar
  await p.keyboard.press('n'); await p.waitForTimeout(200);
  const sr = 44100;
  const check = (label, x, want) => {
    const i0 = onsetNear(x, 0); let worst = 0; const offs = want.map(t => { const i = onsetNear(x, Math.round(t * sr)); return i < 0 ? 9999 : i - Math.round(t * sr) - i0; });
    for (const o of offs) worst = Math.max(worst, Math.abs(o));
    console.log(`${label}: ${want.length} Schläge, größte Abweichung ${worst} Samples${worst > 2 ? '  ← AUFFÄLLIG ' + offs.join(' ') : ''}`);
  };
  await step('Tempowechsel per Lineal', async () => {
    await tempoAtBar(2, 60); // ab Takt 3 (Beat 8): 60 BPM
    const P = await proj(); console.log('Tempowechsel:', JSON.stringify(P.tempos), '| Schilder im Lineal:', await p.locator('.ruler .tp').count(), '|', await p.locator('.ruler .tp').first().textContent());
    // Takt 1 und 2 dauern bei 120 BPM je 2 s, Takt 3 und 4 bei 60 BPM je 4 s
    const want = [0, 2, 4, 8];
    check('Export 120 → 60 BPM', await exp('tp1.wav'), want);
  });
  await step('Zweiter Wechsel und Anzeige', async () => {
    await tempoAtBar(3, 180); // ab Takt 4 (Beat 12): 180 BPM
    const want = [0, 2, 4, 8]; // Takt 4 beginnt nach Takt 3 (4 s bei 60 BPM)
    check('Export 120 → 60 → 180 BPM', await exp('tp2.wav'), want);
    // Tempo-Feld folgt der Abspielposition
    const shown = []; await p.keyboard.press('Enter');
    for (let i = 0; i < 4; i++) { shown.push(await p.inputValue('#bpm')); await p.keyboard.press('ArrowRight'); }
    console.log('Tempo-Feld Takt 1–4:', shown.join(' '), shown.join(' ') === '120 120 60 180' ? '(richtig)' : '← FALSCH');
  });
  await step('Abspielen über die Wechsel', async () => {
    // Takt 1–2 dauern zusammen 4 s, dann 1 s pro Schlag: nach 5,5 s steht die Wiedergabe auf Takt 3, Schlag 2, dritte 16tel
    await p.keyboard.press('Enter'); await p.keyboard.press('Space'); const t0 = Date.now();
    await p.waitForTimeout(5500); const lcd = (await p.textContent('#lcdPos')).trim(), dt = Date.now() - t0, bpmShown = await p.inputValue('#bpm');
    await p.keyboard.press('Space');
    console.log(`nach ${(dt / 1000).toFixed(2)} s: ${lcd} | Tempo-Feld ${bpmShown}`, /^003 2/.test(lcd) && bpmShown === '60' ? '(richtig)' : '← PRÜFEN');
  });
  await step('Ändern über das Tempo-Feld', async () => {
    await p.keyboard.press('Enter'); for (let i = 0; i < 2; i++) await p.keyboard.press('ArrowRight'); // Takt 3
    await p.fill('#bpm', '90'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    const P = await proj(); console.log('nach Eingabe 90 in Takt 3:', JSON.stringify(P.tempos), '| Grundtempo', P.bpm);
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
    console.log('Rückgängig:', JSON.stringify((await proj()).tempos));
  });
  await step('Taktartwechsel verschiebt Tempowechsel mit', async () => {
    const [x, y] = await barX(1); await p.mouse.click(x, y, { button: 'right' });
    await p.locator('#ctxMenu .cx-chips button', { hasText: '3/4' }).first().click(); await p.waitForTimeout(300);
    const P = await proj(); console.log('Taktart ab Takt 2 = 3/4 → Tempowechsel bei Beats', P.tempos.map(c => c.b).join(', '), '(erwartet 7, 10)');
    await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  });
  await step('MIDI hin und zurück', async () => {
    const dl = p.waitForEvent('download'); await p.click('#bFile'); await p.click('[data-file="mid"]'); const d = await dl; await d.saveAs(D + 'tp.mid');
    const before = (await proj()).tempos;
    await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
    await p.locator('#midiIn').setInputFiles(D + 'tp.mid'); await p.waitForTimeout(800);
    const P = await proj(); console.log('MIDI: Tempo', P.bpm, 'Wechsel', JSON.stringify(P.tempos), JSON.stringify(P.tempos) === JSON.stringify(before) ? '(gleich)' : '← ANDERS als ' + JSON.stringify(before));
  });
  await step('Audio folgt dem Tempo über den Wechsel', async () => {
    const P = await proj();
    // Eine Audio-Region, die dem Tempo folgt (Original 120 BPM, 4 Takte), über alle Wechsel
    await p.locator('#fileIn').setInputFiles(__dirname + '/fixtures/loop.wav'); await p.waitForTimeout(1200);
    const bn = p.locator('#banner button', { hasText: 'Nein' }); if (await bn.count() && await bn.isVisible()) await bn.click();
    // Region auf Beat 4 legen (über den Wechsel 120 → 60 bei Beat 8), dem Songtempo folgen lassen, Drums stumm
    await p.locator('.region', { hasText: 'loop' }).first().dblclick({ position: { x: 20, y: 30 } }); await p.waitForTimeout(400);
    await p.locator('#aflex').check(); await p.waitForTimeout(400);
    await p.locator('.track-row[data-track]', { hasText: 'Drummer' }).first().locator('[data-act="mute"]').click();
    const R = await p.locator('.region', { hasText: 'loop' }).first().boundingBox();
    await p.mouse.move(R.x + 40, R.y + 30); await p.mouse.down(); await p.mouse.move(R.x + 40 + 4 * 30 + 2, R.y + 30, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(2500);
    const Q = await proj(), t = Q.tracks.find(t => t.type === 'audio' && t.regions.length), r = t?.regions[0];
    console.log('Audio-Region:', r ? `Start ${r.start} Länge ${+r.len.toFixed(3)} Tempo ${r.tempo}` : 'fehlt', '| Tempowechsel', JSON.stringify(Q.tempos || P.tempos));
    const x = await exp('tp3.wav'); let last = 0; for (let i = x.length - 1; i > 0; i--) if (Math.abs(x[i]) > 1e-3) { last = i; break; }
    const secs = b => b <= 8 ? b * .5 : b <= 12 ? 4 + (b - 8) : 8 + (b - 12) / 3; // Sekunden an Beat b bei 120 → 60 → 180
    let first = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 1e-3) { first = i; break; }
    const rms = (a, b) => { let e = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) e += x[i] * x[i]; return Math.sqrt(e / ((b - a) * sr)); };
    console.log('  Pegel je halbe Sekunde:', Array.from({ length: 20 }, (_, i) => rms(i / 2, i / 2 + .5).toFixed(3)).join(' '));
    console.log(`Export mit gedehntem Audio: erster Ton ${(first / sr).toFixed(3)} s (erwartet ${secs(r.start).toFixed(3)}), letzter ${(last / sr).toFixed(2)} s (Regionsende bei ${secs(r.start + r.len).toFixed(2)} s)`);
  });
};
