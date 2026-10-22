const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createAppServer } = require('../server');
const cert = fs.readFileSync(path.join(__dirname, '../certs/localhost-cert.pem'));
const key = fs.readFileSync(path.join(__dirname, '../certs/localhost-key.pem'));

test('HTTPS, limite real, recuperacion y sesiones', async t => {
  let clock = Date.now();
  const server = createAppServer({ key, cert }, () => clock);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  function request(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
      const body = data ? JSON.stringify(data) : undefined;
      const req = https.request({ hostname: '127.0.0.1', port, path: url,
        method: data ? 'POST' : 'GET', ca: cert,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }
      }, res => {
        const protocol = res.socket.getProtocol();
        let text = '';
        res.on('data', chunk => text += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, protocol }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  const login = (password, extra = {}) => request('/api/login', { username: 'estudiante', password }, extra);
  await t.test('TLS con certificado validado; HTTP plano rechazado', async () => {
    const response = await request('/');
    assert.equal(response.status, 200);
    assert.match(response.protocol, /^TLSv1\.[23]$/);
    await assert.rejects(new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port, timeout: 2000 }, resolve);
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('HTTP rechazado')));
    }));
  });
  await t.test('Cinco fallos: HTTP 401; sexto intento: HTTP 429', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login('incorrecta')).status, 401);
    const blocked = await login('ciclos123');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers['retry-after'], '60');
    assert.match(blocked.text, /Demasiados intentos/);
  });
  await t.test('Cambiar X-Forwarded-For no permite evadir el bloqueo', async () => {
    assert.equal((await login('ciclos123', { 'X-Forwarded-For': '192.0.2.9' })).status, 429);
  });
  await t.test('Bloqueo vigente a los 59 segundos; acceso permitido a los 60', async () => {
    clock += 59_000;
    assert.equal((await login('ciclos123')).status, 429);
    clock += 1_000;
    const response = await login('ciclos123');
    assert.equal(response.status, 200);
    const cookie = response.headers['set-cookie'][0];
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    const sessionCookie = cookie.split(';')[0];
    const session = await request('/api/session', undefined, { Cookie: sessionCookie });
    assert.equal(JSON.parse(session.text).authenticated, true);
    await request('/api/logout', {}, { Cookie: sessionCookie });
    const ended = await request('/api/session', undefined, { Cookie: sessionCookie });
    assert.equal(JSON.parse(ended.text).authenticated, false);
  });
});
