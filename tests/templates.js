// Vorlagen: jede öffnen, abspielen, exportieren; Lautheit und Fehler prüfen
const fs = require('fs'), D = __dirname + '/out/';
const lufs = f => require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-']).stderr.toString().split('Summary:').pop().match(/I:\s+(-?[\d.]+) LUFS/)?.[1];
module.exports = async p => {
  for (const k of ['song', 'keys', 'jazz', 'orchester', 'beat', 'elektro', 'demo']) {
    await p.click('#bFile'); await p.click('[data-file="new"]'); await p.click(`[data-tpl="${k}"]`); await p.waitForTimeout(600);
    const P = await p.evaluate(() => JSON.parse(localStorage.getItem('klangwerk.project')));
    // Ohne Noten: in jede Instrument-Spur ein paar Akkordtöne legen, damit man etwas hört
    let added = 0;
    for (const t of P.tracks) if (t.type === 'synth' && !t.regions.length) { t.regions = [{ id: 'n' + t.id, name: 'Test', start: 0, len: 8, notes: [0, 2, 4, 6].map((s, i) => ({ p: [48, 55, 60, 64][i] + (t.name.match(/Bass/i) ? -12 : 0), s, l: 1.8, v: .75 })) }]; added++; }
    if (added) { fs.writeFileSync(D + 'tpl.soundgroot.json', JSON.stringify({ format: 'klangwerk', project: P, audio: {} })); await p.locator('#projIn').setInputFiles(D + 'tpl.soundgroot.json'); await p.waitForTimeout(900); }
    await p.keyboard.press('Space'); await p.waitForTimeout(1500); await p.keyboard.press('Space');
    await p.keyboard.press('Control+e'); await p.waitForTimeout(250); await p.locator('#xFmt').selectOption('wav16'); await p.locator('#xNorm').selectOption('off');
    const dl = p.waitForEvent('download', { timeout: 120000 }); await p.locator('#xGo').click(); const d = await dl; await d.saveAs(D + 'tpl.wav');
    console.log(k.padEnd(10), P.tracks.map(t => `${t.name}: ${t.type === 'drums' ? t.kit : t.preset || t.type}`).join(', '), '|', lufs(D + 'tpl.wav'), 'LUFS');
  }
};
