/* HelixBoard test runner: every suite in a fresh, empty profile; a summary table at the end.  node runall.js [names…] */
const { spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const S = __dirname;
const ELECTRON = ['once', 'lc', 'rp', 'vl', 'cl', 'link', 'phone2', 'self', 'gm', 'po', 'xp', 'end', 'sq', 'join1', 'crawl3', 'tq', 'tqar', 'sx'];
const BROWSER = ['mm', 'mm3', 'mm4', 'anim', 'tr2', 'nx', 'pc2', 'qimp', 'ppt', 'kb'];
const pick = process.argv.slice(2), all = ELECTRON.concat(BROWSER).filter(n => !pick.length || pick.includes(n));
const rows = [];
for (const n of all) { const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hbprof-')), t0 = Date.now();
  const cmd = ELECTRON.includes(n) ? ['xvfb-run', ['-a', 'node', S + '/' + n + '.js', S]] : ['node', [S + '/' + n + '.js', S]];
  const r = spawnSync(cmd[0], cmd[1], { cwd: S, env: Object.assign({}, process.env, { HB_USER_DATA: prof }), encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || ''), lines = out.split('\n').filter(l => l && !/agent-proxy|__agentproxy|connect_rejected|redirector/.test(l));
  const errLine = lines.find(l => /^(ERRORS|errs)\b/.test(l.trim())) || '';
  const ok = r.status === 0 && /\[\s*\]|ERRORS 0\b/.test(errLine) && !/TimeoutError|^FAIL|Error: /m.test(out);
  rows.push([n, ok ? 'PASS' : 'FAIL', Math.round((Date.now() - t0) / 1000) + 's', ok ? '' : (lines.filter(l => /FAIL|Error|ERRORS|errs|Timeout|waiting for/.test(l)).slice(0, 3).join(' | ') || lines.slice(-2).join(' | ')).slice(0, 220)]);
  fs.rmSync(prof, { recursive: true, force: true }); console.log(rows[rows.length - 1].join('  ')); }
const fail = rows.filter(r => r[1] === 'FAIL').length; console.log('\n' + (rows.length - fail) + '/' + rows.length + ' suites passed' + (fail ? ' — ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
