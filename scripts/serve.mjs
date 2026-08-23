#!/usr/bin/env node
/**
 * The production static server — the whole "backend" of To Do Matrix.
 *
 * Tasks live in each browser's localStorage, so the server's only job is to
 * hand out the built PWA. Deliberately dependency-free (node:http only): the
 * quickstart installs no npm packages on the serving path, and there is
 * nothing to upgrade or audit beyond Node itself.
 *
 *   node scripts/serve.mjs --dir dist --port 8688 --host 0.0.0.0
 *
 * Flags override env vars (WEB_DIR, PORT, HOST), which override defaults —
 * the same precedence CountRoster's serve command uses.
 *
 * Behavior the PWA depends on:
 *   - SPA fallback: an extensionless path serves index.html (client routing),
 *     but a missing *file* is a real 404 — a broken asset reference must not
 *     come back as HTML.
 *   - Cache headers: hashed /assets/ are immutable; index.html, sw.js and the
 *     manifest are no-cache so a deploy is picked up on the next visit and
 *     the service worker can update itself.
 *   - GET/HEAD only; /healthz answers the quickstart's health check.
 */
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

function arg(flag, envName, fallback) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[envName] ?? fallback;
}

const ROOT = resolve(arg('--dir', 'WEB_DIR', 'dist'));
const PORT = Number(arg('--port', 'PORT', '8688'));
const HOST = arg('--host', 'HOST', '0.0.0.0');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

async function readFileOrNull(path) {
  try {
    const stat = await fs.stat(path);
    if (!stat.isFile()) return null;
    return await fs.readFile(path);
  } catch {
    return null;
  }
}

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'method not allowed', {
      'content-type': 'text/plain; charset=utf-8',
      allow: 'GET, HEAD',
    });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'bad request', { 'content-type': 'text/plain; charset=utf-8' });
  }

  if (pathname === '/healthz') {
    return send(res, 200, '{"ok":true}', { 'content-type': 'application/json; charset=utf-8' });
  }

  // Resolve inside the web root only — a `..` that escapes it is a 404, not
  // a file read.
  let filePath = resolve(join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    return send(res, 404, 'not found', { 'content-type': 'text/plain; charset=utf-8' });
  }
  if (pathname.endsWith('/')) filePath = join(filePath, 'index.html');

  let body = await readFileOrNull(filePath);
  let served = filePath;
  if (body === null) {
    // SPA fallback for extensionless navigations; missing files stay 404.
    if (extname(filePath) !== '') {
      return send(res, 404, 'not found', { 'content-type': 'text/plain; charset=utf-8' });
    }
    served = join(ROOT, 'index.html');
    body = await readFileOrNull(served);
    if (body === null) {
      return send(res, 404, 'not found', { 'content-type': 'text/plain; charset=utf-8' });
    }
  }

  const immutable = pathname.startsWith('/assets/');
  const headers = {
    'content-type': MIME[extname(served)] ?? 'application/octet-stream',
    'content-length': body.byteLength,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    return res.end();
  }
  return send(res, 200, body, headers);
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${ROOT} on http://${HOST}:${PORT}`);
});
