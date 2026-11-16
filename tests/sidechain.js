module.exports = async p => {
  await p.locator('.track-row[data-track] .tico').nth(1).click({ button: 'right' }); await p.waitForTimeout(150);
  await p.locator('#ctxMenu button', { hasText: 'Sidechain' }).click(); await p.waitForTimeout(200);
  await p.screenshot({ path: __dirname + '/out/sc1.png' });
  await p.locator('#ctxMenu button', { hasText: 'Drummer' }).click(); await p.waitForTimeout(600);
  console.log('Toast:', await p.textContent('#toast'));
  await p.keyboard.press('v'); await p.waitForTimeout(300);
  console.log('Kompressor an:', await p.locator('#compOn').isChecked(), '| Sidechain:', await p.locator('#compSc').evaluate(e => e.selectedOptions[0].textContent));
  await p.keyboard.press('Space');
  let max = 0; for (let i = 0; i < 25; i++) { await p.waitForTimeout(100); max = Math.max(max, await p.evaluate(() => parseFloat(document.querySelector('.gr b')?.style.width) || 0)); }
  await p.keyboard.press('Space');
  console.log('größte Pegelreduktion beim Abspielen:', max + ' %');
  await p.locator('.track-row[data-track] .tico').nth(1).click({ button: 'right' }); await p.locator('#ctxMenu button', { hasText: 'Sidechain: von' }).click();
  await p.locator('#ctxMenu button', { hasText: 'ausschalten' }).click(); await p.waitForTimeout(300);
  console.log('nach Aus:', await p.locator('#compOn').isChecked());
};
