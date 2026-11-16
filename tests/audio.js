const D = __dirname + '/' + '';
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  await p.keyboard.press('n');   // Editor zu: Platz für alle Spuren
  await p.locator('#fileIn').setInputFiles(__dirname + '/fixtures/loop.wav'); await p.waitForTimeout(1000);
  const bn = p.locator('#banner button', { hasText: 'Nein' }); if (await bn.count() && await bn.isVisible()) await bn.click();
  let P = await proj(); const t = P.tracks.find(t => t.type === 'audio' && t.regions.length);
  const loc = p.locator('.region', { hasText: 'loop' }).last(); await loc.scrollIntoViewIfNeeded();
  let rg = await loc.boundingBox();
  await p.keyboard.down('Alt'); await p.mouse.click(rg.x + rg.width / 2, rg.y + 30); await p.keyboard.up('Alt'); await p.waitForTimeout(300);
  P = await proj(); let rs = P.tracks.find(x => x.id === t.id).regions;
  console.log('Alt+Klick teilt: Regionen', rs.length, '|', rs.map(x => `${x.start}/${+x.len.toFixed(2)}/${+(x.offset || 0).toFixed(3)}`).join('  '), '| lückenlos:', Math.abs(rs[0].start + rs[0].len - rs[1].start) < 1e-6, '| Offset passt:', Math.abs((rs[1].offset || 0) - rs[0].len * 60 / P.bpm) < 1e-3);
  rg = await p.locator('.region', { hasText: 'loop' }).last().boundingBox();
  await p.keyboard.down('Alt'); await p.mouse.move(rg.x + rg.width - 3, rg.y + 30); await p.mouse.down(); await p.mouse.move(rg.x + rg.width + 60, rg.y + 30, { steps: 5 }); await p.mouse.up(); await p.keyboard.up('Alt'); await p.waitForTimeout(1800);
  P = await proj(); let x = P.tracks.find(q => q.id === t.id).regions.at(-1); console.log('Alt+Ziehen dehnt: st', x.st, 'Länge', +x.len.toFixed(2), '| Berechnung fertig:', await p.locator('.rtags .busy').count() === 0);
  // Anfang kürzen und Blenden ziehen
  rg = await p.locator('.region', { hasText: 'loop' }).first().boundingBox();
  await p.mouse.move(rg.x + 2, rg.y + 40); await p.mouse.down(); await p.mouse.move(rg.x + 32, rg.y + 40, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
  P = await proj(); x = P.tracks.find(q => q.id === t.id).regions[0]; console.log('Anfang gekürzt: Start', x.start, 'Offset', +(x.offset || 0).toFixed(3), '(erwartet', +(x.start * 60 / P.bpm).toFixed(3) + ')');
  const fh = await p.locator('.region .fh.fi').first().boundingBox(); if (fh) { await p.mouse.move(fh.x + 5, fh.y + 5); await p.mouse.down(); await p.mouse.move(fh.x + 35, fh.y + 5, { steps: 3 }); await p.mouse.up(); }
  P = await proj(); console.log('Einblenden gezogen:', P.tracks.find(q => q.id === t.id).regions[0].fi, 's');
  await p.keyboard.press('Enter'); await p.keyboard.press('Space'); await p.waitForTimeout(2200);
  console.log('Pegel Audio-Spur beim Abspielen:', await p.evaluate(id => getComputedStyle(document.querySelector(`.track-row[data-track="${id}"] .tmeter b`)).getPropertyValue('--m'), t.id));
  await p.keyboard.press('Space');
  // In Sampler umwandeln, danach rückgängig
  await p.locator('.region', { hasText: 'loop' }).first().click({ button: 'right', position: { x: 20, y: 30 } }); await p.locator('#ctxMenu button', { hasText: 'In Sampler' }).click(); await p.waitForTimeout(1200);
  P = await proj(); console.log('Sampler aus Region: Spuren', P.tracks.length, '| Chops', P.tracks.at(-1).chops?.length);
  await p.keyboard.press('Control+z'); P = await proj(); console.log('nach Undo: Spuren', P.tracks.length);
};
