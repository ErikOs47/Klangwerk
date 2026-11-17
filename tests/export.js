const { execFileSync } = require('child_process'); const fs = require('fs');
const D = __dirname + '/out/' + '';
module.exports = async p => {
  const probe = f => { try { const o = execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect,ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 26 }); return o; } catch (e) { return (e.stderr || '') + (e.stdout || ''); } };
  const info = f => { const o = execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect,ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'buffer' }); return ''; };
  const run = f => { let err = ''; try { execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect,ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { err = String(e.stderr); } return err; };
  const sp = require('child_process').spawnSync;
  const meas = f => { const r = sp('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect,ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }); const s = r.stderr || ''; const g = re => (s.match(re) || [])[1];
    return { dur: g(/Duration: ([\d:.]+)/), codec: (s.match(/Audio: ([^\n,]+,[^\n,]+,[^\n,]+,[^\n,]+)/) || [])[1], max: g(/max_volume: (-?[\d.]+) dB/), I: (s.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop(), tp: (s.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop(), ok: r.status === 0 }; };
  await p.keyboard.press('Control+e'); await p.waitForTimeout(300);
  const fmts = await p.locator('#xFmt option').evaluateAll(o => o.map(x => x.value)), norms = await p.locator('#xNorm option').evaluateAll(o => o.map(x => x.value));
  console.log('Formate:', fmts.join(','), '| Normalisieren:', norms.join(','));
  await p.keyboard.press('Escape');
  const jobs = [...fmts.map(f => [f, norms[0]]), ...norms.slice(1).map(n => [fmts[0], n])];
  for (const [fmt, norm] of jobs) {
    try {
      await p.keyboard.press('Control+e'); await p.waitForTimeout(250);
      await p.locator('#xFmt').selectOption(fmt); await p.locator('#xNorm').selectOption(norm);
      const mix = p.locator('#modal input[name=what][value=mix]'); if (await mix.count()) await mix.evaluate(e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
      const dl = p.waitForEvent('download', { timeout: 90000 });
      await p.locator('#xGo').click(); const d = await dl; const f = D + fmt + '-' + norm + '-' + d.suggestedFilename().replace(/\s/g, '_'); await d.saveAs(f);
      await p.waitForTimeout(400);
      const m = meas(f); console.log(`${fmt.padEnd(8)} ${norm.padEnd(5)} ${(fs.statSync(f).size / 1024 | 0) + ' kB'} ${m.ok ? '' : 'NICHT LESBAR '}${m.dur} | ${m.codec} | max ${m.max} dB | ${m.I} | ${m.tp} | ${(await p.textContent('#toast')).slice(0, 90)}`);
      if (!(await p.locator('#modal').isHidden())) await p.keyboard.press('Escape');
    } catch (e) { console.log(fmt, norm, 'FEHLER', e.message.split('\n')[0]); await p.keyboard.press('Escape'); }
  }
  // Cycle-Bereich
  try {
    await p.keyboard.press('Control+e'); await p.waitForTimeout(250);
    await p.locator('#xFmt').selectOption(fmts[0]); await p.locator('#xNorm').selectOption(norms[0]);
    const cyc = p.locator('#modal input[name=range][value=cycle]');
    if (await cyc.count()) { await cyc.evaluate(e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); const dl = p.waitForEvent('download', { timeout: 60000 }); await p.locator('#xGo').click(); const d = await dl; const f = D + 'cycle.wav'; await d.saveAs(f); console.log('Cycle-Bereich (Takt 1–8 bei 96 BPM = 20 s + Ausklang):', meas(f).dur); } else console.log('kein Cycle-Bereich im Dialog');
  } catch (e) { console.log('cycle FEHLER', e.message.split('\n')[0]); }
};
