module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const step = async (name, f) => { try { await f(); } catch (e) { console.log('STEP FEHLER', name, e.message.split('\n').slice(0, 3).join(' | ')); } };
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.fill('#bpm', '180'); await p.keyboard.press('Enter');
  await p.click('#bCount');   // Vorzähler aus
  // Cycle über 2 Takte, MIDI-Aufnahme über 3 Runden → Takes
  const r = await p.locator('#ruler').boundingBox();
  await p.mouse.move(r.x + 5, r.y + 8); await p.mouse.down(); await p.mouse.move(r.x + 200, r.y + 8, { steps: 5 }); await p.mouse.up();
  await p.locator('.track-row[data-track] .tico').nth(1).click();
  await step('aufnahme', async () => {
    await p.keyboard.press('r'); await p.waitForTimeout(200);
    for (let i = 0; i < 14; i++) { const k = 'asdfg'[i % 5]; await p.keyboard.down(k); await p.waitForTimeout(120); await p.keyboard.up(k); await p.waitForTimeout(480); }
    await p.keyboard.press('Space'); await p.waitForTimeout(500);
  });
  let P = await proj(); let reg = P.tracks[1].regions[0];
  console.log('Aufnahme: Regionen', P.tracks[1].regions.length, '| Takes', reg?.takes?.length, '| aktiver Take', reg?.take, '| Noten', reg?.notes.length, '| Länge', reg?.len, '| alle Noten in der Region:', reg?.notes.every(n => n.s >= 0 && n.s < reg.len));
  await step('takes', async () => {
    console.log('Take-Auswahl sichtbar:', await p.locator('#takeSel').count(), '| Take-Zeilen:', await p.locator('.trowk').count());
    await p.locator('#takeSel').selectOption('0'); await p.waitForTimeout(300);
    P = await proj(); console.log('nach Wechsel auf Take 1: take', P.tracks[1].regions[0].take, 'Noten', P.tracks[1].regions[0].notes.length);
    // Comping: in Take-Zeile 2 ziehen
    const st = await p.locator('.tstrip').nth(1).boundingBox();
    await p.mouse.move(st.x + st.width * .5, st.y + 10); await p.mouse.down(); await p.mouse.move(st.x + st.width * .9, st.y + 10, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
    P = await proj(); reg = P.tracks[1].regions[0]; console.log('Comp:', JSON.stringify(reg.comp), 'take', reg.take, 'Noten', reg.notes.length);
    await p.keyboard.press('Space'); await p.waitForTimeout(700); await p.keyboard.press('Space');
    await p.locator('[data-takeonly]').click(); await p.waitForTimeout(300);
    P = await proj(); console.log('nach „Nur diesen Take“: takes', P.tracks[1].regions[0].takes, 'Noten', P.tracks[1].regions[0].notes.length);
    await p.keyboard.press('Control+z'); P = await proj(); console.log('Undo holt Takes zurück:', P.tracks[1].regions[0].takes?.length);
  });
  // Aufnahme ohne Cycle, Region wächst
  await step('linear', async () => {
    await p.keyboard.press('c'); await p.keyboard.press('Enter');
    await p.locator('.track-row[data-track] .tico').nth(1).click();
    const before = (await proj()).tracks[1].regions.length;
    const rr = await p.locator('#ruler').boundingBox(); await p.mouse.click(rr.x + 16 * 30 + 2, rr.y + 20);
    await p.keyboard.press('r'); await p.waitForTimeout(150);
    for (let i = 0; i < 8; i++) { await p.keyboard.down('h'); await p.waitForTimeout(100); await p.keyboard.up('h'); await p.waitForTimeout(400); }
    await p.keyboard.press('Space');
    P = await proj(); const rg = P.tracks[1].regions.at(-1); console.log('ohne Cycle: Regionen', before, '→', P.tracks[1].regions.length, '| Start', rg.start, 'Länge', rg.len, 'Noten', rg.notes.length, '| ganze Takte:', rg.len % 4 === 0);
  });
  // Drums live ohne Cycle: Pattern wächst
  await step('drums linear', async () => {
    await p.locator('.track-row[data-track] .tico').nth(0).click();
    const rr = await p.locator('#ruler').boundingBox(); await p.mouse.click(rr.x + 16 * 30 + 2, rr.y + 20);
    await p.keyboard.press('r'); await p.waitForTimeout(150);
    for (let i = 0; i < 12; i++) { await p.keyboard.press(i % 2 ? 's' : 'a'); await p.waitForTimeout(330); }
    await p.keyboard.press('Space');
    P = await proj(); const rg = P.tracks[0].regions.at(-1); console.log('Drums ohne Cycle: Start', rg.start, 'Länge', rg.len, 'pb', rg.pb, 'Kicks', rg.steps.kick.filter(v => v).length, 'Snares', rg.steps.snare.filter(v => v).length, '| Toast:', (await p.textContent('#toast')).slice(0, 50));
  });
};
