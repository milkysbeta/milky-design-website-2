const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const { serve } = require('./serve');

const args = process.argv.slice(2);
const port = Number(args.find((argument) => /^\d+$/.test(argument))) || 5192;
const noBrowser = args.includes('--no-browser');

const brave = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
].find((candidate) => fs.existsSync(candidate));

function open(url) {
  if (brave) spawn(brave, [url], { detached: true, stdio: 'ignore' }).unref();
  else spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
}

function portInUse(value) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: value, host: '127.0.0.1' });
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    setTimeout(() => { socket.destroy(); resolve(false); }, 600);
  });
}

(async () => {
  const url = `http://localhost:${port}/`;
  if (await portInUse(port)) {
    console.log(`MILKY 2 is already running at ${url}`);
  } else {
    await serve(port);
    console.log('');
    console.log('  MILKY DESIGN WEBSITE 2 - running');
    console.log(`  ${url}`);
    console.log('');
    console.log('  Close this window to stop the site.');
    console.log('');
  }
  if (!noBrowser) open(url);
})().catch((error) => {
  console.error(`Could not start MILKY 2: ${error.message}`);
  process.exitCode = 1;
});
