// Ende-zu-Ende: echte Electron-App, Plugin-Host unter Wine, Test-Plugins (VST3 und VST2)
const { _electron } = require('playwright');
require('fs').mkdirSync(__dirname + '/out', { recursive: true });
(async () => {
  const app = await _electron.launch({ executablePath: require('path').resolve(__dirname, '..') + '/' + 'node_modules/electron/dist/electron', cwd: require('path').resolve(__dirname, '..'), args: ['.', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, SG_VST_WINE: '1', SG_VST_DIRS: require('path').resolve(__dirname, '..') + '/' + 'build/vst3host', WINEDEBUG: '-all' } });
  const errs = [];
  let win = null;
  for (let i = 0; i < 40 && !win; i++) { for (const w of app.windows()) if (/index\.html/.test(w.url())) win = w; if (!win) await new Promise(r => setTimeout(r, 500)); }
  if (!win) throw new Error('kein Fenster');
  win.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  win.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await win.waitForTimeout(3500);
  await win.evaluate(() => { localStorage.setItem('klangwerk.tour', '1'); });
  await win.keyboard.press('Escape');
  const log = (...a) => console.log(...a);
  try {
    // Jeder Lauf beginnt mit einem frischen Demo-Song
    await win.click('#bFile'); await win.click('[data-file="new"]'); await win.click('[data-tpl="demo"]'); await win.waitForTimeout(800);
    await win.locator('.track-row[data-track] .sm.fxb').nth(1).click(); await win.waitForTimeout(6000);
    const opts = await win.locator('#plAdd option').allTextContents();
    log('Effekte:', opts.filter(o => /SG Test|Simple|Sound Groot/.test(o)).join(' | '));
    log('Karte:', (await win.locator('.pl-vst .hint').first().textContent()).slice(0, 110));
    for (const name of ['SG Testgain2', 'SG Testgain']) {
      const val = await win.locator('#plAdd option', { hasText: name }).first().getAttribute('value');
      await win.locator('#plAdd').selectOption(val); await win.waitForTimeout(3500);
    }
    log('Inserts:', (await win.locator('.pl-row .pl-name').allTextContents()).join(' | '));
    await win.keyboard.press('Space'); await win.waitForTimeout(2500);
    log('Pegel Bass beim Abspielen:', await win.evaluate(() => getComputedStyle(document.querySelectorAll('.track-row[data-track] .tmeter b')[1]).getPropertyValue('--m') || document.querySelectorAll('.track-row[data-track] .tmeter')[1].style.cssText));
    await win.keyboard.press('Space');
    // Instrument-Plugin (VST2) auf der Bass-Spur
    const iv = await win.locator('#plInst option', { hasText: 'SG Testsynth2' }).first().getAttribute('value');
    await win.locator('#plInst').selectOption(iv); await win.waitForTimeout(3500);
    log('Instrument:', await win.locator('#plInst').evaluate(e => e.selectedOptions[0].textContent));
    await win.keyboard.press('Space'); await win.waitForTimeout(2000);
    log('Pegel mit VST2-Synth:', await win.evaluate(() => getComputedStyle(document.querySelectorAll('.track-row[data-track] .tmeter b')[1]).getPropertyValue('--m')));
    await win.keyboard.press('Space'); await win.waitForTimeout(500);
    // Export mit geladenen VST-Plugins: Datei abfangen und prüfen (Anfang auf dem Schlag, Bass hörbar)
    const out = __dirname + '/out/' + 'e2e.wav'; try { require('fs').unlinkSync(out); } catch (e) { }
    await app.evaluate(({ session }, out) => { session.defaultSession.on('will-download', (e, item) => item.setSavePath(out)); }, out);
    await win.evaluate(() => { delete window.showSaveFilePicker; });
    const exportCheck = async (list, kick) => { for (const solo of list) {
      if (solo === 0) await win.locator('.track-row[data-track]').nth(1).locator('[data-act="solo"]').click();
      if (solo !== false) { await win.locator('.track-row[data-track]').nth(solo).locator('[data-act="solo"], .tsolo, button[title*="Solo"]').first().click(); await win.waitForTimeout(300); }
      await win.keyboard.press('Control+e'); await win.waitForTimeout(400); await win.locator('#xFmt').selectOption('wav32'); await win.locator('#xNorm').selectOption('off'); await win.locator('#xGo').click();
      for (let i = 0; i < 240 && !(require('fs').existsSync(out) && await win.locator('#busy').isHidden()); i++) await win.waitForTimeout(500);
      await win.waitForTimeout(1500);
      const b = require('fs').readFileSync(out); let o = 12, ch = 2, data = null; while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'fmt ') ch = b.readUInt16LE(o + 10); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
      const N = data.length / 4 / ch, x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = data.readFloatLE(i * 4 * ch);
      let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); const first = x.findIndex(v => Math.abs(v) > 1e-3);
      log(solo === 1 ? 'Export nur Bass (VST2-Synth + VST-Effekte):' : solo === 0 ? 'Export nur Schlagzeug (Latenzausgleich aktiv), erste Samples ' + [...x.slice(0, 5)].map(v => v.toFixed(4)).join(' ') + ':' : 'Export ganzer Song mit VST:', (N / 44100).toFixed(2) + ' s, Spitze', pk.toFixed(3), '| erster Ton bei Sample', first, `(${(first / 44.1).toFixed(2)} ms)`, '| Meldung:', await win.evaluate(() => document.querySelector('#toast').hidden ? '-' : document.querySelector('#toast').textContent.slice(0, 70)));
      if (kick) { let p2 = 0; for (let i = 22050; i < 26050; i++) p2 = Math.max(p2, Math.abs(x[i])); let p1 = 0; for (let i = 0; i < 4000; i++) p1 = Math.max(p1, Math.abs(x[i])); log('   Sample-Kick: erste Samples', [...x.slice(0, 5)].map(v => v.toFixed(4)).join(' '), '| Pegel 1. Schlag', p1.toFixed(3), '2. Schlag', p2.toFixed(3)); }
      require('fs').unlinkSync(out);
    } };
    await exportCheck([false, 1, 0]);
    // Zweite Phase: leeres Projekt mit Sample-Kick (eindeutiger Anfang) und VST-Effekten auf der zweiten Spur
    await win.click('#bFile'); await win.click('[data-file="new"]'); await win.click('[data-tpl="leer"]'); await win.waitForTimeout(600);
    await win.fill('#bpm', '120'); await win.keyboard.press('Enter');
    const hw = await win.evaluate(() => document.querySelector('.thead').getBoundingClientRect().right), lane = await win.locator('.lane[data-track]').first().boundingBox();
    await win.mouse.dblclick(hw + 10, lane.y + 30); await win.waitForTimeout(500);
    await win.locator('#patsel').selectOption('Leer'); await win.waitForTimeout(300);
    for (const k of [0, 4, 8, 12]) await win.locator(`.cell[data-d="kick"][data-k="${k}"]`).click();
    await win.locator('.track-row[data-track] .sm.fxb').nth(1).click(); await win.waitForTimeout(2500);
    for (const name of ['SG Testgain2', 'SG Testgain']) { const val = await win.locator('#plAdd option', { hasText: name }).first().getAttribute('value'); await win.locator('#plAdd').selectOption(val); await win.waitForTimeout(3500); }
    log('Phase 2, Inserts auf Spur 2:', (await win.locator('.pl-row .pl-name').allTextContents()).join(' | '));
    await exportCheck([false], true);
    // Editor-Fenster des VST2-Plugins öffnen
    await win.locator('.pl-row .pl-name').first().click(); await win.waitForTimeout(1500);
    await win.screenshot({ path: __dirname + '/out/e1.png' });
    log('Toast:', await win.evaluate(() => document.querySelector('#toast').hidden ? '-' : document.querySelector('#toast').textContent));
  } catch (e) { errs.push('ACT: ' + e.message.split('\n')[0]); await win.screenshot({ path: __dirname + '/out/e1.png' }).catch(() => { }); }
  console.log(errs.length ? errs.join('\n') : 'keine Fehler');
  await app.close();
})().catch(e => { console.log('FEHLER', e.message); process.exit(1); });
