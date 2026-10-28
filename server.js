const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = 8443;
const dir = __dirname;
const certDir = path.join(dir, 'cert');

function localIPs() {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list) if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  return ips;
}

function ensureCert(ips) {
  const key = path.join(certDir, 'key.pem');
  const crt = path.join(certDir, 'cert.pem');
  const stamp = path.join(certDir, 'ips.txt');
  const sig = ips.join(',');
  if (fs.existsSync(key) && fs.existsSync(crt) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === sig)
    return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
  fs.mkdirSync(certDir, { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map(ip => 'IP:' + ip)].join(',');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
    '-keyout', key, '-out', crt, '-subj', '/CN=wepland', '-addext', 'subjectAltName=' + san], { stdio: 'ignore' });
  fs.writeFileSync(stamp, sig);
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

const ips = localIPs();
const server = https.createServer(ensureCert(ips), (req, res) => {
  const name = req.url.split('?')[0];
  if (name === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ urls: ips.map(ip => 'https://' + ip + ':' + PORT + '/phone') }));
  }
  const file = name === '/' || name === '/viewer' ? 'viewer.html' : name === '/phone' ? 'phone.html' : null;
  if (!file) { res.writeHead(404); return res.end('yok'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(dir, 'public', file)).pipe(res);
});

const wss = new WebSocketServer({ server });
const peers = { phone: null, viewer: null };
const other = r => (r === 'phone' ? 'viewer' : 'phone');
const send = (ws, m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));

const CAM = process.env.WEPLAND_CAM || '/dev/video10';
let ff = null;
let size = { w: 1280, h: 720 };
function camStart() {
  if (ff || !fs.existsSync(CAM)) return;
  ff = spawn('ffmpeg', ['-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '30', '-i', '-',
    '-vf', 'scale=' + size.w + ':' + size.h, '-pix_fmt', 'yuv420p', '-f', 'v4l2', CAM],
    { stdio: ['pipe', 'ignore', 'inherit'] });
  ff.stdin.on('error', () => {});
  ff.on('exit', () => { ff = null; });
}
function camStop() { if (ff) { ff.stdin.end(); ff.kill(); ff = null; } }

wss.on('connection', (ws, req) => {
  const role = req.url.includes('role=phone') ? 'phone' : 'viewer';
  if (peers[role] && peers[role] !== ws) peers[role].close();
  peers[role] = ws;
  send(peers[other(role)], { type: 'peer', role, online: true });
  send(ws, { type: 'peer', role: other(role), online: !!peers[other(role)] });
  ws.on('message', (d, isBinary) => {
    if (isBinary) { camStart(); if (ff && ff.stdin.writable && ff.stdin.writableLength < 1e6) ff.stdin.write(d); return; }
    const m = JSON.parse(d);
    if (m.type === 'size') {
      size = { w: m.w | 0, h: m.h | 0 };
      camStop();
      return;
    }
    send(peers[other(role)], m);
  });
  ws.on('close', () => {
    if (peers[role] === ws) { peers[role] = null; if (role === 'viewer') camStop(); send(peers[other(role)], { type: 'peer', role, online: false }); }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(fs.existsSync(CAM) ? '\nSanal kamera hazır: wepland (' + CAM + ')' : '\nSanal kamera YOK (Discord için modül yüklenmeli)');
  console.log('Bilgisayar:  https://localhost:' + PORT + '/');
  for (const ip of ips) console.log('iPhone Safari: https://' + ip + ':' + PORT + '/phone');
  console.log('\nÇıkmak için Ctrl+C\n');
});
