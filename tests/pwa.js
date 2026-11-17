const { chromium } = require('playwright');
(async () => {
  const url = await require('./srv.js')();
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1200, height: 800 } }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 150)); });
  await p.addInitScript(() => { try { localStorage.setItem('klangwerk.tour', '1'); } catch (e) { } });
  await p.goto(url); await p.waitForTimeout(3000);
  console.log('Service Worker aktiv:', await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }));
  console.log('Datei-Menü zeigt Offline-Einträge:', await p.evaluate(() => [...document.querySelectorAll('[data-pwa]')].filter(e => !e.hidden).length));
  // einen eigenen Effekt und einen Klang einmal benutzen, damit sie im Speicher liegen
  await p.locator('.track-row[data-track] .sm.fxb').nth(1).click(); await p.waitForTimeout(300); await p.locator('#plAdd').selectOption('plugins/sg/chorus.js'); await p.waitForTimeout(1200);
  await c.setOffline(true);
  await p.reload(); await p.waitForTimeout(3000);
  console.log('offline neu geladen: App da:', await p.locator('.track-row[data-track]').count(), 'Spuren | Chorus geladen:', (await p.locator('.track-row[data-track] .sm.fxb').nth(1).click(), await p.waitForTimeout(1500), await p.locator('.pl-row .pl-name').first().textContent()));
  await p.keyboard.press('Space'); await p.waitForTimeout(1500);
  console.log('spielt offline:', await p.evaluate(() => document.querySelector('#bPlay').classList.contains('on')), '| Pegel:', await p.evaluate(() => getComputedStyle(document.querySelectorAll('.track-row[data-track] .tmeter b')[1]).getPropertyValue('--m')));
  await p.keyboard.press('Space');
  // ein noch nie benutzter Effekt offline
  await p.locator('#plAdd').selectOption('plugins/sg/phaser.js'); await p.waitForTimeout(1500);
  console.log('neuer Effekt offline:', (await p.locator('.pl-row .pl-name').allTextContents()).join(' | '), '| Meldung:', await p.evaluate(() => document.querySelector('#toast').hidden ? '-' : document.querySelector('#toast').textContent.slice(0, 90)));
  console.log(errs.length ? errs.slice(0, 6).join('\n') : 'keine Fehler');
  await b.close();
})();
