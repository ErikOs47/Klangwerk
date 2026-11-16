module.exports = async p => {
  const cdp = await p.context().newCDPSession(p);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
  const tap = async (x, y) => { await T('touchStart', [[x, y]]); await T('touchEnd', []); await p.waitForTimeout(130); };
  const hold = async (x, y) => { await T('touchStart', [[x, y]]); await p.waitForTimeout(650); await T('touchEnd', []); await p.waitForTimeout(350); };
  const drag = async (x0, y0, x1, y1) => { await T('touchStart', [[x0, y0]]); for (let i = 1; i <= 6; i++) { await T('touchMove', [[x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6]]); await p.waitForTimeout(20); } await T('touchEnd', []); await p.waitForTimeout(200); };
  const center = async sel => { const b = await p.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const step = async (name, f) => { try { await f(); } catch (e) { console.log('STEP FEHLER', name, e.message.split('\n').slice(0, 3).join(' | ')); } };
  await tap(...await center('#bMetro')); await tap(...await center('#bMetro'));
  await step('neue spur', async () => { await tap(...await center('#bAdd')); await p.waitForTimeout(200); await tap(...await center('[data-add="synth"]')); await p.waitForTimeout(300); console.log('Spuren:', (await proj()).tracks.length, '| Dialog zu:', await p.locator('#modal').isHidden()); });
  await step('bibliothek', async () => { await tap(...await center('#bLib')); await p.waitForTimeout(350); console.log('Bibliothek offen:', !(await p.locator('#lib.closed').count())); await tap(370, 400); await p.waitForTimeout(300); console.log('Tippen daneben schließt:', !!(await p.locator('#lib.closed').count())); });
  await step('spurmenü', async () => { const [x, y] = await center('.track-row[data-track] .tname'); await hold(x - 40, y + 22); console.log('Spurmenü als Blatt:', await p.locator('#ctxMenu.sheet').count(), '| Einträge:', await p.locator('#ctxMenu button').count()); const b = await p.locator('#ctxMenu button', { hasText: 'Duplizieren' }).boundingBox(); await tap(b.x + 30, b.y + 12); console.log('dupliziert:', (await proj()).tracks.length); });
  await step('region ziehen', async () => { const b = await p.locator('.region', { hasText: 'Am F C G' }).first().boundingBox(); const before = (await proj()).tracks.find(t => t.name === 'Akkorde').regions[0].start; await drag(b.x + 60, b.y + 30, b.x + 180, b.y + 30); const P = await proj(); console.log('Region per Finger verschoben:', before, '→', P.tracks.find(t => t.name === 'Akkorde').regions[0].start); });
  await step('zoom mit zwei fingern', async () => { const z0 = await p.locator('#zoom').inputValue(); await T('touchStart', [[220, 250], [300, 250]]); for (let i = 1; i <= 6; i++) { await T('touchMove', [[220 - i * 8, 250], [300 + i * 8, 250]]); await p.waitForTimeout(30); } await T('touchEnd', []); await p.waitForTimeout(400); console.log('Zoom:', z0, '→', await p.locator('#zoom').inputValue()); });
  await step('keyboard', async () => {
    await tap(...await center('.track-row[data-track]:has-text("Bass") .tname')); await tap(...await center('#bKeys')); await p.waitForTimeout(300);
    const k = await p.locator('.kb-w').nth(2).boundingBox(); await T('touchStart', [[k.x + k.width / 2, k.y + k.height - 15]]); await p.waitForTimeout(200);
    console.log('Taste leuchtet:', await p.locator('.kb-w.on, .kb-pad.on').count(), '| Pegel:', await p.evaluate(() => Math.max(...[...document.querySelectorAll('.track-row[data-track] .tmeter b')].map(e => +getComputedStyle(e).getPropertyValue('--m')))).catch(() => '?'));
    await T('touchEnd', []);
    console.log('Platz fürs Arrangement mit Keyboard:', Math.round((await p.locator('#arrange').boundingBox()).height), 'px');
  });
  await step('aufnahme per keyboard', async () => {
    await tap(...await center('#bRec')); await p.waitForTimeout(1500);
    for (let i = 0; i < 5; i++) { const k = await p.locator('.kb-w, .kb-pad').nth(i % 4).boundingBox(); await T('touchStart', [[k.x + k.width / 2, k.y + k.height - 20]]); await p.waitForTimeout(150); await T('touchEnd', []); await p.waitForTimeout(250); }
    await tap(...await center('#bPlay')); await p.waitForTimeout(500);
    const P = await proj(); console.log('Aufnahme am Handy:', P.tracks.map(t => t.name + ':' + t.regions.length).join(' '), '| Toast:', (await p.evaluate(() => document.querySelector('#toast').textContent)).slice(0, 60));
  });
  await step('editor + note', async () => {
    await tap(...await center('#bKeys'));
    const b = await p.locator('.region').first().boundingBox(); await tap(b.x + 40, b.y + 30); await tap(b.x + 40, b.y + 30); await p.waitForTimeout(400);
    console.log('Editor offen:', !(await p.locator('#editor').isHidden()), '| Inhalt:', await p.evaluate(() => document.querySelector('#ebody').firstElementChild?.className));
    const c = p.locator('.cell').nth(5); if (await c.count()) { const cb = await c.boundingBox(); await tap(cb.x + 10, cb.y + 10); await hold(cb.x + 10, cb.y + 10); console.log('Feld-Menü:', await p.locator('#ctxMenu button').count()); await tap(200, 100); }
    await tap(...await center('.edx')); console.log('Editor wieder zu:', await p.locator('#editor').isHidden());
  });
  await step('drehen', async () => { await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(500); const bar = await p.locator('.bar').boundingBox(); console.log('quer: Leiste', Math.round(bar.height), 'px hoch | sichtbare Spuren:', await p.evaluate(() => [...document.querySelectorAll('.track-row[data-track]')].filter(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length)); await p.screenshot({ path: 'ph2.png' }); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400); });
  await p.screenshot({ path: 'ph1.png' });
};
