// Zufallstester: node fuzz.js <seed> <schritte> [w h] [touch]
const { chromium } = require('playwright');
require('fs').mkdirSync(__dirname + '/out', { recursive: true });
(async () => {
  const [seed0, steps, w = 1440, h = 900, touch] = process.argv.slice(2);
  let seed = +seed0 || 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, pick = a => a[Math.floor(rnd() * a.length)];
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!touch, isMobile: !!touch });
  const p = await c.newPage(); p.setDefaultTimeout(1500);
  const errs = new Map(), hist = [];
  const note = (k, m) => { if (!errs.has(k)) errs.set(k, { m, n: 0, hist: hist.slice(-6) }); errs.get(k).n++; };
  p.on('pageerror', e => note(e.message.slice(0, 90), e.message + '\n   ' + (e.stack || '').split('\n').slice(1, 4).map(s => s.trim().replace(/http:\/\/127.0.0.1:\d+\//, '')).join('\n   ')));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) note('console:' + m.text().slice(0, 90), 'console: ' + m.text().slice(0, 300)); });
  p.on('dialog', d => d.dismiss().catch(() => { }));
  await p.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete window.showDirectoryPicker; try { localStorage.setItem('klangwerk.tour', '1'); } catch (e) { } });
  const URL0 = await require(__dirname + '/' + 'srv.js')(); await p.goto(URL0); await p.waitForTimeout(1500);
  const KEYS = ['Space', 'Space', 'Enter', 'r', 'c', 'm', 'n', 'v', 'i', 'b', 'q', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'Delete', 'Backspace', 'Control+z', 'Control+z', 'Control+Shift+z', 'Control+d', 'Control+c', 'Control+v', 'Control+x', 'Control+a', 'Control+t', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Escape', ',', '.', 'Home', '1', '2'];
  const SEL = ['button:visible', 'button:visible', '.region', '.region', '.lane', '.thead', '.tico', '.nt', '.cell', '.cell', '.pad', '.kb-w', '.lib-item:visible', '.lib-chip', '.lib-cat', 'select:visible', 'input[type=range]:visible', 'input[type=checkbox]:visible', '.mk', '.ruler', '.strip .kn', '.fader', '#ctxMenu button', '#ctxMenu button', '.tabs button', '.chip', '.apt', '.alane', '.sm:visible', '.tile', '[data-st]', '.pr-grid', '.smp-wave', '.eq-graph', '.key'];
  const BAD = /data-file="(open|save|saveas|install|offline|midiin|audio)"|id="(bMidi|bInScan|bLatMeasure|stTour)"|data-act="import"|Audiodatei laden|Sample laden|Eigenes Sample|Ordner (wählen|hinzufügen)|data-go="(tour|rec)"|data-lib-act|smpload|type="file"/;
  for (let i = 0; i < +steps; i++) {
    const kind = rnd();
    try {
      if (kind < .2) { const k = pick(KEYS); hist.push('key ' + k); await p.keyboard.press(k); }
      else if (kind < .78) {
        const sel = pick(SEL), loc = p.locator(sel), n = await loc.count(); if (!n) continue;
        const el = loc.nth(Math.floor(rnd() * Math.min(n, 60)));
        const html = await el.evaluate(e => e.outerHTML.slice(0, 160)).catch(() => ''); if (!html || BAD.test(html)) continue;
        const box = await el.boundingBox().catch(() => null); if (!box || box.width < 2 || box.x + box.width < 0 || box.x > +w || box.y > +h || box.y + box.height < 0) continue;
        const x = Math.min(+w - 2, Math.max(1, box.x + rnd() * box.width)), y = Math.min(+h - 2, Math.max(1, box.y + rnd() * box.height)), r = rnd();
        if (sel.startsWith('select')) { const vals = await el.evaluate(e => [...e.options].filter(o => !o.disabled).map(o => o.value)); if (vals.length) { hist.push('select ' + html.slice(0, 60)); await el.selectOption(pick(vals)).catch(() => { }); } }
        else if (sel.startsWith('input[type=range]')) { hist.push('range ' + html.slice(0, 60)); await el.evaluate((e, f) => { e.value = +e.min + f * (+e.max - +e.min); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, rnd()); }
        else if (r < .55) { hist.push('click ' + sel + ' ' + html.slice(0, 50)); await p.mouse.click(x, y); }
        else if (r < .7) { hist.push('rclick ' + sel); await p.mouse.click(x, y, { button: 'right' }); }
        else if (r < .8) { hist.push('dbl ' + sel); await p.mouse.dblclick(x, y); }
        else { hist.push('drag ' + sel); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + (rnd() - .5) * 300, y + (rnd() - .5) * 160, { steps: 4 }); await p.mouse.up(); }
      } else if (kind < .86) { hist.push('wheel'); await p.mouse.move(rnd() * w, rnd() * h); await p.keyboard.down('Control'); await p.mouse.wheel(0, (rnd() - .5) * 400); await p.keyboard.up('Control'); }
      else if (kind < .9) { hist.push('resize'); await p.setViewportSize({ width: Math.round(+w * (.6 + rnd() * .5)), height: Math.round(+h * (.6 + rnd() * .5)) }); await p.waitForTimeout(50); await p.setViewportSize({ width: +w, height: +h }); }
      else { hist.push('wait'); await p.waitForTimeout(150 + rnd() * 300); }
    } catch (e) { /* Element verschwunden o. Ä. */ }
    if (i % 200 === 199) { const ok = await p.evaluate(() => !!document.querySelector('#rows')).catch(() => false); if (!ok) { note('TOT', 'Seite reagiert nicht mehr bei Schritt ' + i); break; } }
  }
  await p.waitForTimeout(400);
  const state = await p.evaluate(() => { try { const P = JSON.parse(localStorage.getItem('klangwerk.project')); return `${P.tracks.length} Spuren, ${P.tracks.reduce((a, t) => a + t.regions.length, 0)} Regionen, ${P.bpm} BPM, sig ${P.sig || '4/4'} ${JSON.stringify(P.sigs || [])}`; } catch (e) { return 'kein Projekt'; } });
  console.log(`seed ${seed0}: ${steps} Schritte, Zustand: ${state}, ${errs.size} verschiedene Fehler`);
  for (const [, e] of errs) console.log(` [${e.n}×] ${e.m}\n   zuletzt: ${e.hist.join(' → ')}`);
  await b.close();
})();
