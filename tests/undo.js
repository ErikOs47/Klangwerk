module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(420); return p.evaluate(() => { const P = JSON.parse(localStorage.getItem('klangwerk.project'));
    // nur der Kern: was der Nutzer bearbeitet hat (nachträglich ergänzte Standardwerte zählen nicht)
    return JSON.stringify({ bpm: P.bpm, sig: P.sig || [4, 4], sigs: P.sigs || [], markers: P.markers, tracks: P.tracks.map(t => ({ id: t.id, name: t.name, type: t.type, color: t.color, preset: t.preset, kit: t.kit, out: t.out, regions: t.regions, ins: (t.ins || []).map(i => i.url), sc: t.fx?.comp?.on ? t.fx.comp.sc || null : null, auto: t.auto || {} })) }); }); };
  const hw = async () => p.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right);
  await p.click('#bMetro'); await p.click('#bMetro');
  const snaps = [await proj()], names = ['Start'];
  const edit = async (name, f) => { try { await f(); } catch (e) { console.log('  Schritt scheitert:', name, e.message.split('\n')[0]); } const s = await proj(); if (s !== snaps.at(-1)) { snaps.push(s); names.push(name); } else console.log('  (keine Änderung durch:', name + ')'); };
  const menu = async (loc, txt, opt) => { await loc.click({ button: 'right', ...opt }); await p.locator('#ctxMenu button', { hasText: txt }).first().click(); };
  await edit('Region verschieben', async () => { const b = await p.locator('.region', { hasText: 'Hook' }).boundingBox(); await p.mouse.move(b.x + 40, b.y + 30); await p.mouse.down(); await p.mouse.move(b.x - 200, b.y + 30, { steps: 5 }); await p.mouse.up(); });
  await edit('Region kürzen', async () => { const b = await p.locator('.region', { hasText: 'Am F C G' }).first().boundingBox(); await p.mouse.move(b.x + b.width - 3, b.y + 30); await p.mouse.down(); await p.mouse.move(b.x + b.width - 123, b.y + 30, { steps: 5 }); await p.mouse.up(); });
  await edit('Duplizieren', async () => { await menu(p.locator('.region', { hasText: 'Fill' }), 'Duplizieren', { position: { x: 20, y: 30 } }); });
  await edit('Teilen', async () => { const r = await p.locator('#ruler').boundingBox(); await p.mouse.click(r.x + 6 * 30 + 2, r.y + 20); await p.locator('.region', { hasText: 'Bass' }).first().click({ position: { x: 20, y: 30 } }); await p.keyboard.press('b'); });
  await edit('Region löschen', async () => { await p.locator('.region', { hasText: 'Bass' }).first().click({ position: { x: 20, y: 30 } }); await p.keyboard.press('Delete'); });
  await edit('Spur hinzufügen', async () => { await p.click('#bAdd'); await p.click('[data-add="synth"]'); });
  await edit('Spur umbenennen', async () => { await menu(p.locator('.track-row[data-track] .tico').nth(1), 'Umbenennen'); await p.fill('#askIn', 'Tiefbass'); await p.keyboard.press('Enter'); });
  await edit('Spurfarbe', async () => { await p.locator('.track-row[data-track] .tico').nth(2).click({ button: 'right' }); await p.locator('#ctxMenu .cx-chips.cols button').nth(5).click(); });
  await edit('Taktartwechsel', async () => { const r = await p.locator('#ruler').boundingBox(); await p.mouse.click(r.x + 12 * 30 + 4, r.y + 20, { button: 'right' }); await p.locator('#ctxMenu .cx-chips button', { hasText: '6/8' }).click(); });
  await edit('Marker', async () => { const r = await p.locator('#ruler').boundingBox(); await p.mouse.click(r.x + 250, r.y + 20, { button: 'right' }); await p.locator('#ctxMenu button', { hasText: 'Marker an Takt' }).click(); });
  await edit('Tempo', async () => { await p.fill('#bpm', '123'); await p.keyboard.press('Enter'); await p.locator('.lane').first().click({ position: { x: 900, y: 60 } }); });
  await edit('Note zeichnen', async () => { await p.locator('.region', { hasText: 'Hook' }).dblclick({ position: { x: 30, y: 30 } }); await p.waitForTimeout(300); const g = await p.locator('#pr').boundingBox(); await p.mouse.click(g.x + 160, g.y + 40); });
  await edit('Drum-Schritt', async () => { await p.locator('.region', { hasText: 'Pop' }).first().dblclick({ position: { x: 30, y: 30 } }); await p.waitForTimeout(300); await p.locator('.cell[data-d="tom"][data-k="2"]').click(); });
  await edit('Sidechain', async () => { await p.locator('.track-row[data-track] .tico').nth(2).click({ button: 'right' }); await p.locator('#ctxMenu button', { hasText: 'Sidechain' }).click(); await p.locator('#ctxMenu button', { hasText: 'Drummer' }).click(); });
  await edit('Effekt einfügen', async () => { await p.keyboard.press('v'); await p.waitForTimeout(200); await p.locator('#plAdd').selectOption('plugins/sg/chorus.js'); await p.waitForTimeout(500); });
  await edit('Spur duplizieren', async () => { await menu(p.locator('.track-row[data-track] .tico').nth(0), 'Duplizieren'); });
  await edit('Spur löschen', async () => { await menu(p.locator('.track-row[data-track] .tico').nth(3), 'Spur löschen'); });
  console.log(names.length - 1, 'Bearbeitungen:', names.slice(1).join(', '));
  let bad = 0;
  await p.locator('.lane').first().click({ position: { x: 1000, y: 60 } }).catch(() => { });
  for (let i = snaps.length - 2; i >= 0; i--) { await p.keyboard.press('Control+z'); const s = await proj(); if (s !== snaps[i]) { bad++; const a = JSON.parse(s), b = JSON.parse(snaps[i]); const keys = Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); console.log(`  Undo von „${names[i + 1]}“ weicht ab in: ${keys.join(', ')}`); if (keys.includes('tracks')) { const d = b.tracks.map((t, j) => JSON.stringify(t) === JSON.stringify(a.tracks[j]) ? null : t.name + ':' + Object.keys({ ...t, ...(a.tracks[j] || {}) }).filter(k => JSON.stringify(t[k]) !== JSON.stringify((a.tracks[j] || {})[k])).join('/')).filter(Boolean); console.log('    Spuren:', d.join(' | ')); } } }
  console.log('Undo-Abweichungen:', bad);
  bad = 0;
  for (let i = 1; i < snaps.length; i++) { await p.keyboard.press('Control+Shift+z'); const s = await proj(); if (s !== snaps[i]) { bad++; console.log(`  Redo von „${names[i]}“ weicht ab`); } }
  console.log('Redo-Abweichungen:', bad);
};
