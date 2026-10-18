const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2'
};

function serve(port) {
  const server = http.createServer((request, response) => {
    let relative = decodeURIComponent(request.url.split('?')[0]);
    if (relative === '/favicon.ico') relative = '/assets/milky.ico';
    if (relative.endsWith('/')) relative += 'index.html';

    const file = path.join(ROOT, path.normalize(relative).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) {
      response.writeHead(403).end('forbidden');
      return;
    }

    fs.stat(file, (error, stats) => {
      if (error || stats.isDirectory()) {
        response.writeHead(404, { 'content-type': 'text/plain' }).end(`404 ${relative}`);
        return;
      }

      response.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'content-length': stats.size,
        'cache-control': 'no-cache'
      });
      fs.createReadStream(file).pipe(response);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { serve, ROOT };

if (require.main === module) {
  const port = Number(process.argv[2]) || 5192;
  serve(port)
    .then(() => console.log(`MILKY 2 -> http://localhost:${port}/`))
    .catch((error) => {
      console.error(`Could not start: ${error.message}`);
      process.exit(1);
    });
}
