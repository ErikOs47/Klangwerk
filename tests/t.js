// node t.js <w> <h> <out.png> [actions.js]   -- actions.js exports async (page) => {}
const { chromium } = require('playwright'); const path = require('path');
require('fs').mkdirSync(__dirname + '/out', { recursive: true });
(async () => {
  const [w, h, out, act, touch] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const p = await c.newPage(); const errs = []; p.setDefaultTimeout(5000);
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
  await p.addInitScript(() => { try { delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete window.showDirectoryPicker; if (!localStorage.getItem('t.init')) { localStorage.setItem('klangwerk.tour', '1'); localStorage.setItem('t.init', '1'); } } catch (e) { } });
  const URL0 = await require(__dirname + '/' + 'srv.js')(); await p.goto(URL0); await p.waitForTimeout(1800);
  try { if (act) await require(path.resolve(act))(p); } catch (e) { errs.push('ACT: ' + e.message.split('\n')[0]); }
  await p.waitForTimeout(300);
  if (out !== '-') await p.screenshot({ path: out });
  console.log(errs.length ? errs.join('\n') : 'keine Fehler');
  await b.close();
})();
