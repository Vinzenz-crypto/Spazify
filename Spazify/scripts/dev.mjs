// Local development server: serves the website from ./public and runs the same API
// code as the Netlify Function. Data is stored as JSON files in ./.data
//
//   npm run dev                      -> http://127.0.0.1:8888
//   SPAZIFY_NO_API=1 npm run dev     -> simulates a "drag & drop" deploy without functions
//
// Optional: create a .env file with SPOTIFY_CLIENT_ID=... (see README).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from '../server/api.mjs';
import { fileAdapter } from '../server/stores.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const PORT = Number(process.env.PORT || 8888);
const HOST = process.env.HOST || '127.0.0.1';

// Tiny .env loader (KEY=value per line).
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const api = createApi({ store: fileAdapter(path.join(root, '.data')), env: process.env });
const noApi = process.env.SPAZIFY_NO_API === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function handleApi(req, res, url) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(url, {
    method: req.method,
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string')),
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
  const response = await api(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function serveStatic(req, res, url) {
  let filePath = path.normalize(path.join(publicDir, decodeURIComponent(url.pathname)));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (noApi) {
          res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>Page not found</h1>');
          return;
        }
        await handleApi(req, res, url);
        return;
      }
      serveStatic(req, res, url);
    } catch (err) {
      console.error(err);
      res.writeHead(500).end('Server error');
    }
  })
  .listen(PORT, HOST, () => {
    console.log(`\n  Spazify is running at http://${HOST}:${PORT}\n`);
    if (noApi) console.log('  (API disabled - the site runs in "this device only" mode)\n');
    if (!process.env.SPOTIFY_CLIENT_ID) console.log('  Tip: add SPOTIFY_CLIENT_ID=... to a .env file to try the Spotify login.\n');
  });
