const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { serve } = require('./serve');

const args = process.argv.slice(2);
const noBrowser = args.includes('--no-browser');
const firstPort = 5192;
const lastPort = 5201;
const logFile = path.join(__dirname, 'auto-start.log');
const siteTitle = '<title>MILKY — Design, code & strange digital things</title>';
const siteCanvas = '<canvas id="forest"';

const brave = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
].find((candidate) => fs.existsSync(candidate));

function log(message) {
  const stamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${stamp}] ${message}\n`, 'utf8');
}

function openBrowser(url) {
  if (noBrowser) return;
  if (brave) {
    spawn(brave, [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();
}

function inspectPort(port) {
  return new Promise((resolve) => {
    const request = http.get({
      host: '127.0.0.1',
      port,
      path: '/',
      timeout: 900,
      headers: { Accept: 'text/html' }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        if (body.length < 131072) body += chunk;
      });
      response.on('end', () => resolve({
        port,
        occupied: true,
        isMilky: response.statusCode === 200 && body.includes(siteTitle) && body.includes(siteCanvas)
      }));
    });

    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve({ port, occupied: false, isMilky: false }));
  });
}

function socketOccupied(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(700, () => finish(false));
  });
}

async function findExistingSite() {
  for (let port = firstPort; port <= lastPort; port += 1) {
    const result = await inspectPort(port);
    if (result.isMilky) return port;
  }
  return null;
}

async function findFreePort() {
  for (let port = firstPort; port <= lastPort; port += 1) {
    if (!(await socketOccupied(port))) return port;
  }
  return null;
}

async function main() {
  const existingPort = await findExistingSite();
  if (existingPort !== null) {
    const url = `http://127.0.0.1:${existingPort}/?autostart=existing&launch=${Date.now()}#top`;
    log(`Found the MILKY site already running on port ${existingPort}; ${noBrowser ? 'browser launch suppressed' : `opening ${url}`}`);
    openBrowser(url);
    return;
  }

  const port = await findFreePort();
  if (port === null) throw new Error(`No free local port was found from ${firstPort} to ${lastPort}.`);

  await serve(port);
  const verification = await inspectPort(port);
  if (!verification.isMilky) throw new Error(`The server started on ${port}, but the MILKY identity check failed.`);

  const url = `http://127.0.0.1:${port}/?autostart=started&launch=${Date.now()}#top`;
  log(`Started the MILKY site on port ${port}; ${noBrowser ? 'browser launch suppressed' : `opening ${url}`}`);
  openBrowser(url);
}

main().catch((error) => {
  try {
    log(`ERROR: ${error.stack || error.message}`);
  } catch (_) {
    // There is nowhere safer to report an error from a hidden login launcher.
  }
  process.exitCode = 1;
});

