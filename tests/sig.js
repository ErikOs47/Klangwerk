module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const step = async (name, f) => { try { await f(); } catch (e) { console.log('STEP FEHLER', name, e.message.split('\n').slice(0, 3).join(' | ')); } };
  await p.keyboard.press('n');
  await p.locator('#zoom').fill('14'); await p.waitForTimeout(500);
  const sigAtBar = async (bar, sig) => { const r = await p.locator('#ruler').boundingBox(); const x = await p.evaluate(b => { const e = [...document.querySelectorAll('.ruler .bn')].find(e => +e.dataset.b === b); return e ? e.getBoundingClientRect().left + 3 : null; }, bar); await p.mouse.click(x ?? r.x + 5, r.y + 20, { button: 'right' }); await p.locator('#ctxMenu .cx-chips button', { hasText: sig }).click(); await p.waitForTimeout(250); };
  await sigAtBar(4, '7/8'); await sigAtBar(6, '3/4'); await sigAtBar(10, '12/8'); await sigAtBar(12, '5/4');
  let P = await proj(); console.log('Wechsel:', JSON.stringify(P.sigs.map(c => [c.bar + 1, c.sig.join('/')])));
  // Taktweise vorgehen: Anzeige muss an jedem Taktanfang „N 1 1“ zeigen und die richtige Taktart
  await p.keyboard.press('Enter'); const seen = [];
  for (let i = 0; i < 15; i++) { seen.push((await p.textContent('#lcdPos')).trim() + ' ' + await p.textContent('#sigBtn')); await p.keyboard.press('ArrowRight'); }
  const okBars = seen.every((s, i) => s.startsWith(String(i + 1).padStart(3, '0') + ' 1 1'));
  console.log('Takt für Takt:', okBars ? 'alle Taktanfänge stimmen' : 'ABWEICHUNG', '|', seen.map(s => s.replace(/^0+/, '').replace(' 1 1 ', ':')).join(' '));
  for (let i = 0; i < 15; i++) await p.keyboard.press('ArrowLeft');
  console.log('zurück am Anfang:', (await p.textContent('#lcdPos')).trim());
  // Drum-Regionen: Taktart jeder Region = Taktart an ihrer Stelle, Regionen beginnen auf Taktanfängen
  const segs = P => { const o = [{ bar: 0, beat: 0, sig: P.sig || [4, 4] }]; for (const c of P.sigs || []) { const l = o.at(-1); o.push({ bar: c.bar, beat: l.beat + (c.bar - l.bar) * l.sig[0] * 4 / l.sig[1], sig: c.sig }); } return o; };
  const sigAt = (P, b) => segs(P).filter(s => s.beat <= b + 1e-9).at(-1).sig, onBar = (P, b) => { const s = segs(P).filter(s => s.beat <= b + 1e-9).at(-1), x = (b - s.beat) / (s.sig[0] * 4 / s.sig[1]); return Math.abs(x - Math.round(x)) < 1e-6; };
  const check = (P, label) => { const bad = []; for (const t of P.tracks) for (const r of t.regions) { if (!(r.start >= 0) || !(r.len > 0) || !Number.isFinite(r.start + r.len)) bad.push(`${t.name}/${r.name}: Zahl`); if (t.type === 'drums' && String(r.sig) !== String(sigAt(P, r.start))) bad.push(`${t.name}/${r.name}@${r.start}: ${r.sig} statt ${sigAt(P, r.start)}`); if (t.type !== 'audio' && !onBar(P, r.start)) bad.push(`${t.name}/${r.name}@${r.start}: nicht am Taktanfang`); } console.log(label + ':', bad.length ? bad.join('; ') : 'in Ordnung', `(${P.tracks.reduce((a, t) => a + t.regions.length, 0)} Regionen)`); };
  P = await proj(); check(P, 'nach 4 Wechseln');
  await step('duplizieren/einfügen', async () => {
    const reg = p.locator('.region', { hasText: 'Pop' }).first(); await reg.click({ position: { x: 10, y: 30 } }); await p.keyboard.press('Control+c');
    for (const n of [5, 8, 11, 13]) { await p.keyboard.press('Enter'); for (let i = 0; i < n; i++) await p.keyboard.press('ArrowRight'); await p.keyboard.press('Control+v'); await p.waitForTimeout(150); }
    await p.keyboard.press('Control+d'); await p.keyboard.press('Control+d');
    P = await proj(); check(P, 'nach Einfügen in vier Abschnitte und Duplizieren');
  });
  await step('wechsel entfernen', async () => {
    for (let i = 0; i < 2; i++) { await p.locator('.ruler .sg').first().click(); await p.locator('#ctxMenu button', { hasText: 'entfernen' }).click(); await p.waitForTimeout(250); }
    P = await proj(); console.log('übrig:', JSON.stringify((P.sigs || []).map(c => [c.bar + 1, c.sig.join('/')]))); check(P, 'nach Entfernen zweier Wechsel');
    await p.keyboard.press('Enter'); await p.keyboard.press('Space'); await p.waitForTimeout(2500); await p.keyboard.press('Space');
  });
  await step('aufnahme im wechsel', async () => {
    await p.click('#bCount');
    await p.locator('.track-row[data-track] .tico').nth(3).click(); await p.keyboard.press('Enter'); for (let i = 0; i < 10; i++) await p.keyboard.press('ArrowRight');
    await p.keyboard.press('r'); await p.waitForTimeout(200); for (let i = 0; i < 6; i++) { await p.keyboard.press('g'); await p.waitForTimeout(300); } await p.keyboard.press('Space');
    P = await proj(); check(P, 'nach Aufnahme im 12/8-Abschnitt'); const r = P.tracks[3].regions.at(-1); console.log('  Aufnahme-Region: Start', r.start, 'Länge', r.len, 'Noten', r.notes.length);
  });
  await step('undo alles', async () => { for (let i = 0; i < 25; i++) await p.keyboard.press('Control+z'); P = await proj(); console.log('nach 25× Undo: Wechsel', JSON.stringify(P.sigs || []), '| Regionen', P.tracks.reduce((a, t) => a + t.regions.length, 0)); check(P, 'Ausgangszustand'); });
};
