const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const image = fs.readFileSync(path.join(root, '.semgrep/image.txt'), 'utf8').trim();
const [mode, ...extra] = process.argv.slice(2);
if (!['scan', 'test'].includes(mode)) {
  console.error('Uso: node scripts/semgrep.cjs scan|test [opciones de Semgrep]');
  process.exit(2);
}
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
const command = mode === 'test'
  ? ['semgrep', '--test', '--metrics=off', '--disable-version-check', '--config', '.semgrep/rules.yml', '.semgrep/rules.js']
  : ['semgrep', 'scan', '--config', '.semgrep/rules.yml', '--metrics=off',
     '--disable-version-check', '--json-output', 'reports/semgrep.json',
     '--sarif-output', 'reports/semgrep.sarif', 'server.js'];
const result = spawnSync('docker', [
  'run', '--rm', '--mount', `type=bind,source=${root},target=/src`,
  '--workdir', '/src', image, ...command, ...extra
], { stdio: 'inherit' });
if (result.error) {
  console.error('No se pudo ejecutar Docker. Comprueba que Docker Desktop esté iniciado.');
  process.exit(2);
}
process.exit(result.status ?? 2);
