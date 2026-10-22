const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const page = fs.readFileSync(path.join(__dirname, 'index.html'));
const salt = randomBytes(16);
const passwordHash = scryptSync('ciclos123', salt, 64);

function createAppServer(tlsOptions, now = Date.now) {
const sessions = new Map();
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 60_000;

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

// El manejador verifica el limite antes de leer credenciales o autenticar.
async function handleLogin(req, res, token) {
    // CORRECCION 2: maximo cinco solicitudes de login por IP en un minuto.
    // No confiamos en X-Forwarded-For: el cliente no puede cambiar la clave.
    const client = req.socket.remoteAddress;
    let limit = attempts.get(client);
    if (!limit || now() >= limit.resetAt) {
      limit = { count: 0, resetAt: now() + BLOCK_MS };
      attempts.set(client, limit);
    }
    if (limit.count >= MAX_ATTEMPTS) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - now()) / 1000));
      req.resume();
      return json(res, 429, { message: `Demasiados intentos. Intenta de nuevo en ${retryAfter} segundos.` }, {
        'Retry-After': String(retryAfter)
      });
    }
    limit.count += 1;
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) return json(res, 413, { message: 'Solicitud demasiado grande.' });
      }
      const { username, password } = JSON.parse(body);
      if (typeof username !== 'string' || typeof password !== 'string') {
        return json(res, 400, { message: 'Ingresa usuario y contraseña.' });
      }
      const matches = timingSafeEqual(scryptSync(password, salt, 64), passwordHash);
      if (username !== 'estudiante' || !matches) {
        return json(res, 401, { message: 'Usuario o contraseña incorrectos. Puedes volver a intentar.' });
      }
      attempts.delete(client);
      if (token) sessions.delete(token);
      const newToken = randomBytes(32).toString('hex');
      sessions.set(newToken, now() + 30 * 60 * 1000);
      return json(res, 200, { message: 'Acceso correcto.' }, {
        'Set-Cookie': `session=${newToken}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`
      });
    } catch {
      return json(res, 400, { message: 'Solicitud no válida.' });
    }
}

// La ruta publica solo puede acceder al manejador protegido.
const routes = new Map([
  ['POST /api/login', handleLogin]
]);

const server = https.createServer({ ...tlsOptions, minVersion: 'TLSv1.2' }, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('session='))?.slice(8);
  const expires = sessions.get(token);
  const authenticated = expires && expires > now();
  if (expires && !authenticated) sessions.delete(token);

  const handler = routes.get(`${req.method} ${req.url}`);
  if (handler) return handler(req, res, token);

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  if (req.method === 'GET' && req.url === '/api/session') {
    return json(res, 200, { authenticated: Boolean(authenticated), user: authenticated ? 'estudiante' : null });
  }
  if (req.method === 'POST' && req.url === '/api/logout') {
    sessions.delete(token);
    return json(res, 200, { message: 'Sesión cerrada.' }, {
      'Set-Cookie': 'session=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
  }
  return json(res, 404, { message: 'Ruta no encontrada.' });
});
return server;
}

// CORRECCION 1: solo HTTPS; no se abre un puerto HTTP alternativo.
if (require.main === module) {
  const certDir = path.join(__dirname, 'certs');
  try {
    const server = createAppServer({
      key: fs.readFileSync(path.join(certDir, 'localhost-key.pem')),
      cert: fs.readFileSync(path.join(certDir, 'localhost-cert.pem'))
    });
    server.listen(PORT, HOST, () => console.log(`Laboratorio de Ciclos: https://${HOST}:${PORT}`));
  } catch (error) {
    console.error('No se pudo iniciar HTTPS. Ejecuta npm run certs para generar el certificado local.');
    process.exitCode = 1;
  }
}
module.exports = { createAppServer };
