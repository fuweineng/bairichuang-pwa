import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

async function resolvePath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const pathname = decodedPath === '/' ? '/index.html' : decodedPath;
  const resolved = path.resolve(rootDir, `.${pathname}`);
  if (!resolved.startsWith(rootDir)) {
    return null;
  }

  const stats = await fs.stat(resolved).catch(() => null);
  if (stats?.isDirectory()) {
    const indexPath = path.join(resolved, 'index.html');
    await fs.access(indexPath);
    return indexPath;
  }

  await fs.access(resolved);
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const filePath = await resolvePath(url.pathname);

    if (!filePath) {
      send(res, 403, 'Forbidden');
      return;
    }

    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, body, {
      'Cache-Control': 'no-cache',
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    });
  } catch (error) {
    send(res, 404, 'Not Found');
  }
});

server.listen(port, () => {
  console.log(`百日闯本地服务已启动: http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
