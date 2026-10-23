// Lädt die mitgelieferten Web-Audio-Module (WAM 2.0) von npm nach src/plugins/<id>/
// und das WAM-SDK (für den Plugin-Host) nach src/vendor/wam-sdk.js. Braucht curl und tar.
// Plugins: burns-audio-wam von Tom Burns (MIT), SDK: @webaudiomodules/sdk (MIT).
// Aufruf: node scripts/fetch-plugins.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'src/plugins'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
const PKGS = { burns: ['burns-audio-wam', '0.2.54'], sdk: ['@webaudiomodules/sdk', '0.0.12'] };
const PLUGINS = ['synth101', 'modal', 'delay', 'distortion', 'simpleEQ'];

function unpack(key) {
  const [name, ver] = PKGS[key], file = path.join(tmp, key + '.tgz'), dir = path.join(tmp, key);
  execFileSync('curl', ['-sfL', '--max-time', '120', '-o', file, `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${ver}.tgz`]);
  fs.mkdirSync(dir); execFileSync('tar', ['xzf', file, '-C', dir]);
  return path.join(dir, 'package');
}
const burns = unpack('burns'), sdk = unpack('sdk');
fs.rmSync(out, { recursive: true, force: true });
for (const id of PLUGINS) {
  const from = path.join(burns, 'dist/plugins', id);
  fs.cpSync(from, path.join(out, id), { recursive: true });
  console.log(id, JSON.parse(fs.readFileSync(path.join(from, 'descriptor.json'), 'utf8')).name);
}
fs.writeFileSync(path.join(out, 'LICENSE.txt'), `Mitgelieferte Plugins aus "burns-audio-wam" ${PKGS.burns[1]} von Tom Burns (Sequencer Party)
https://github.com/boourns/burns-audio-wam
Lizenz: MIT (https://opensource.org/licenses/MIT)
Unverändert übernommen: ${PLUGINS.join(', ')} (scripts/fetch-plugins.js).
`);
fs.writeFileSync(path.join(root, 'src/vendor/wam-sdk.js'), fs.readFileSync(path.join(sdk, 'dist/index.js'), 'utf8').replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n'));
fs.writeFileSync(path.join(root, 'src/vendor/wam-sdk.LICENSE'), `@webaudiomodules/sdk ${PKGS.sdk[1]}, WebAudioModules Working Group
https://github.com/webaudiomodules/sdk
Lizenz: MIT
`);
fs.rmSync(tmp, { recursive: true });
