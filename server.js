const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const page = fs.readFileSync(path.join(__dirname, 'index.html'));
const salt = randomBytes(16);
const passwordHash = scryptSync('ciclos123', salt, 64);
const sessions = new Map();

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('session='))?.slice(8);
  const expires = sessions.get(token);
  const authenticated = expires && expires > Date.now();
  if (expires && !authenticated) sessions.delete(token);

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  if (req.method === 'GET' && req.url === '/api/session') {
    return json(res, 200, { authenticated: Boolean(authenticated), user: authenticated ? 'estudiante' : null });
  }
  if (req.method === 'POST' && req.url === '/api/login') {
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
      // VULNERABILIDAD 6: no hay contador de fallos, bloqueo ni limite de intentos.
      const matches = timingSafeEqual(scryptSync(password, salt, 64), passwordHash);
      if (username !== 'estudiante' || !matches) {
        return json(res, 401, { message: 'Usuario o contraseña incorrectos. Puedes volver a intentar.' });
      }
      if (token) sessions.delete(token);
      const newToken = randomBytes(32).toString('hex');
      sessions.set(newToken, Date.now() + 30 * 60 * 1000);
      return json(res, 200, { message: 'Acceso correcto.' }, {
        'Set-Cookie': `session=${newToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`
      });
    } catch {
      return json(res, 400, { message: 'Solicitud no válida.' });
    }
  }
  if (req.method === 'POST' && req.url === '/api/logout') {
    sessions.delete(token);
    return json(res, 200, { message: 'Sesión cerrada.' }, {
      'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
  }
  return json(res, 404, { message: 'Ruta no encontrada.' });
});

// VULNERABILIDAD 5: HTTP sin TLS. Las credenciales viajan en texto claro.
// Solo escucha en este equipo para mantener la practica dentro del laboratorio.
server.listen(PORT, HOST, () => console.log(`Laboratorio de Ciclos: http://${HOST}:${PORT}`));
