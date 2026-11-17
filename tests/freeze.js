module.exports = async p => {
  // Einfrieren und sofort Tasten drücken: darf weder abstürzen noch abspielen
  await p.locator('.track-row[data-track] .sm.fz').nth(0).click();
  for (const k of ['Space', 'ArrowLeft', 'a', 'Space', 'r', 'Enter']) { await p.keyboard.press(k); await p.waitForTimeout(40); }
  console.log('währenddessen gesperrt:', await p.evaluate(() => !document.querySelector('#busy').hidden), '| spielt:', await p.evaluate(() => document.querySelector('#bPlay').classList.contains('on')));
  await p.waitForFunction(() => document.querySelector('#busy').hidden, null, { timeout: 30000 });
  await p.waitForTimeout(300);
  console.log('danach eingefroren:', await p.locator('.sm.fz.on').count(), '| Sperre weg:', await p.evaluate(() => document.querySelector('#busy').hidden));
  await p.keyboard.press('Space'); await p.waitForTimeout(800);
  console.log('spielt nach dem Einfrieren:', await p.evaluate(() => document.querySelector('#bPlay').classList.contains('on')));
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Space');
};
