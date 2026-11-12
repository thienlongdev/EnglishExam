// Narrow loopback reverse proxy. No files, SQL, master realm, admin or management routes are exposed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, '.local/demo/runtime.json');
const buckets = new Map();
const server = http.createServer((req, res) => {
  const reply = (status, code) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify({ code })); };
  if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(req.method)) return reply(405, 'METHOD_NOT_ALLOWED');
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return reply(400, 'INVALID_PATH'); }
  if (/%2f|%5c|%2e|\\|\.\./i.test(req.url.split('?')[0])) return reply(400, 'INVALID_PATH');
  const p = url.pathname;
  const realm = '/realms/english-exam-demo';
  const identity = p.startsWith('/resources/') && !p.includes('/admin/') ||
    p === realm + '/.well-known/openid-configuration' ||
    p.startsWith(realm + '/protocol/openid-connect/') || p.startsWith(realm + '/login-actions/');
  const backend = p.startsWith('/api/') || p === '/oauth2/authorization/exam' || p === '/login/oauth2/code/exam';
  if (!identity && !backend) return reply(404, 'NOT_FOUND');
  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return reply(503, 'DEMO_STARTING'); }
  const publicUrl = new URL(state.tunnelUrl);
  const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start > 60000) { bucket = { start: now, count: 0 }; buckets.set(ip, bucket); }
  if (++bucket.count > 600) return reply(429, 'RATE_LIMITED');
  if (Number(req.headers['content-length'] || 0) > 1024 * 1024) return reply(413, 'PAYLOAD_TOO_LARGE');
  const headers = { ...req.headers };
  for (const name of Object.keys(headers)) if (/^(forwarded|x-forwarded-|x-real-ip|connection$|upgrade$|transfer-encoding$)/i.test(name)) delete headers[name];
  headers.host = publicUrl.host;
  headers['x-forwarded-proto'] = 'https'; headers['x-forwarded-host'] = publicUrl.host;
  headers['x-forwarded-port'] = '443'; headers['x-forwarded-for'] = String(ip);
  const upstream = http.request({ hostname: '127.0.0.1', port: identity ? 8280 : 8082, path: req.url, method: req.method, headers, timeout: 60000 }, response => {
    const responseHeaders = { ...response.headers, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    delete responseHeaders.server; delete responseHeaders['x-powered-by'];
    res.writeHead(response.statusCode, responseHeaders); response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!res.headersSent) reply(502, 'DEMO_SERVICE_UNAVAILABLE'); else res.destroy(); });
  let received = 0;
  req.on('data', chunk => { received += chunk.length; if (received > 1024 * 1024) { upstream.destroy(); req.destroy(); } });
  req.pipe(upstream);
});
setInterval(() => { const now = Date.now(); for (const [key, bucket] of buckets) if (now - bucket.start > 60000) buckets.delete(key); }, 60000).unref();
server.requestTimeout = 65000; server.headersTimeout = 10000;
server.listen(8090, '127.0.0.1', () => console.log('EnglishExamWeb demo gateway ready on loopback.'));
