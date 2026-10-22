// Solo fixtures para Semgrep; este archivo no se ejecuta.
const http = require('node:http');
const https = require('node:https');

// ruleid: ciclos-http-sin-tls
http.createServer((req, res) => res.end('HTTP'));

// ok: ciclos-http-sin-tls
https.createServer(tlsOptions, (req, res) => res.end('HTTPS'));

function login(req) {
  // ruleid: ciclos-login-revisar-limites
  if (req.method === 'POST' && req.url === '/api/login') {
    authenticate(req);
  }
  // ok: ciclos-login-revisar-limites
  if (req.method === 'POST' && req.url === '/api/logout') {
    logout(req);
  }
}

function loginConProteccion(req) {
  // Sigue siendo un punto de auditoria aunque exista una llamada a un limitador.
  // ruleid: ciclos-login-revisar-limites
  if (req.method === 'POST' && req.url === '/api/login') {
    checkRateLimit(req);
    authenticate(req);
  }
}
