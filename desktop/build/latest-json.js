/* After `npm run dist`: writes release/latest.json, which the Windows app reads to know a new version exists.
   Upload it together with the Setup and Portable .exe files to a GitHub release named v<version>. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const pkg = require('../package.json');
const dir = path.join(__dirname, '..', 'release');
const setup = 'HelixBoard-By-Mr-Hany-Taha-Setup-' + pkg.version + '.exe';
const buf = fs.readFileSync(path.join(dir, setup));
const info = { version: pkg.version, setup, sha256: crypto.createHash('sha256').update(buf).digest('hex'), notes: process.argv[2] || '' };
fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(info, null, 1));
console.log('release/latest.json', info.version, info.sha256);
