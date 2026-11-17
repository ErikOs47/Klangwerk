const fs = require('fs'); const D = __dirname + '/' + '';
module.exports = async p => {
  const proj = async () => { await p.waitForTimeout(450); return p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project'))); };
  const core = P => JSON.stringify({ bpm: P.bpm, sig: P.sig, sigs: P.sigs, markers: P.markers, loop: P.loop, master: P.master, tracks: P.tracks.map(t => ({ name: t.name, type: t.type, preset: t.preset, kit: t.kit, vol: t.vol, pan: t.pan, regions: t.regions, ins: t.ins, auto: t.auto, fx: t.fx })) });
  // Song mit Audio, Effekt, Taktartwechsel, Master leiser
  await p.locator('#fileIn').setInputFiles(__dirname + '/fixtures/loop.wav'); await p.waitForTimeout(1000);
  const bn = p.locator('#banner button', { hasText: 'Nein' }); if (await bn.count() && await bn.isVisible()) await bn.click();
  await p.locator('.track-row[data-track] .sm.fxb').nth(1).click(); await p.waitForTimeout(200); await p.locator('#plAdd').selectOption('plugins/sg/plate.js'); await p.waitForTimeout(500);
  const r = await p.locator('#ruler').boundingBox(); await p.mouse.click(r.x + 8 * 30 + 4, r.y + 20, { button: 'right' }); await p.locator('#ctxMenu .cx-chips button', { hasText: '3/4' }).click();
  await p.locator('#masterVol').evaluate(e => { e.value = .5; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const A = await proj();
  const dl = p.waitForEvent('download'); await p.keyboard.press('Control+s'); const d = await dl; const f = D + 'out/roundtrip.soundgroot.json'; await d.saveAs(f);
  const file = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log('Datei:', (fs.statSync(f).size / 1024 | 0) + ' kB, Format', file.format, '| Audio-Aufnahmen in der Datei:', Object.keys(file.audio || {}).length);
  await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click('[data-tpl="leer"]'); await p.waitForTimeout(300);
  await p.locator('#projIn').setInputFiles(f); await p.waitForTimeout(1200);
  const B = await proj();
  console.log('Inhalt nach Öffnen gleich:', core(A) === core(B), '| Audio-Regionen ohne Audio:', await p.locator('.region.missing').count(), '| Master-Regler:', await p.locator('#masterVol').inputValue());
  if (core(A) !== core(B)) { const a = JSON.parse(core(A)), b = JSON.parse(core(B)); for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log('  anders:', k, JSON.stringify(a[k]).slice(0, 200), '≠', JSON.stringify(b[k]).slice(0, 200)); }
  // Neu laden der Seite: Audio aus dem Browser-Speicher zurück?
  await p.reload(); await p.waitForTimeout(2500);
  console.log('nach Neuladen: fehlendes Audio', await p.locator('.region.missing').count(), '| Regionen', await p.locator('.region').count());
  // Kaputte und fremde Dateien
  const bad = { 'leer.json': '', 'keinjson.soundgroot': 'das ist kein json', 'falsch.json': '{"format":"anders","project":{}}', 'ohnespuren.json': '{"format":"klangwerk","project":{"bpm":100}}', 'fxkaputt.json': '{"format":"klangwerk","project":{"bpm":100,"tempos":[{"b":8,"bpm":"x"},{"b":4,"bpm":300},null],"tracks":[{"type":"synth","fx":{"rev":2},"eq":{"bands":[1]},"regions":[{"start":0,"len":4,"notes":[{"p":60,"s":0,"l":1}]}]}]}}', 'spurkaputt.json': '{"format":"klangwerk","project":{"bpm":100,"tracks":[{"type":"synth"},{"type":"drums","regions":[{}]}],"markers":null}}', 'riesigesTempo.json': '{"format":"klangwerk","project":{"bpm":"abc","tracks":[],"loop":null}}' };
  for (const [n, txt] of Object.entries(bad)) {
    fs.writeFileSync(D + 'out/' + n, txt);
    const before = await p.locator('.track-row[data-track]').count();
    await p.locator('#projIn').setInputFiles(D + 'out/' + n); await p.waitForTimeout(700);
    console.log(` ${n.padEnd(22)} → Spuren ${before}→${await p.locator('.track-row[data-track]').count()} | Meldung: ${(await p.evaluate(() => document.querySelector('#toast').hidden ? '(keine)' : document.querySelector('#toast').textContent)).slice(0, 70)} | Tempo ${await p.locator('#bpm').inputValue()}`);
    await p.keyboard.press('Space'); await p.waitForTimeout(250); await p.keyboard.press('Space');
  }
};
