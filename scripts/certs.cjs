const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dir = path.resolve(__dirname, '../certs');
fs.mkdirSync(dir, { recursive: true });
const key = path.join(dir, 'localhost-key.pem');
const cert = path.join(dir, 'localhost-cert.pem');
if (fs.existsSync(key) && fs.existsSync(cert)) {
  console.log('El certificado local ya existe.');
  process.exit(0);
}
const bundled = 'C:/Program Files/Git/usr/bin/openssl.exe';
const openssl = process.env.OPENSSL || (fs.existsSync(bundled) ? bundled : 'openssl');
const result = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-sha256',
  '-nodes', '-days', '30', '-keyout', key, '-out', cert, '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
  '-addext', 'basicConstraints=critical,CA:FALSE'], { stdio: 'inherit' });
if (result.error || result.status !== 0) {
  console.error('Se necesita OpenSSL. Instala Git para Windows o define OPENSSL con su ruta.');
  process.exit(1);
}
console.log('Certificado autofirmado generado para localhost y 127.0.0.1. Solo para laboratorio.');
