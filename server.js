// รัน: node server.js   (ต้องใช้ Node 18 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
// ตั้งรหัสรีเซ็ต: ADMIN_KEY=รหัสของคุณ node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
const DATA = path.join(__dirname, 'scores.json');

let players = {};
try { players = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) {}
let dirty = false;
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  fs.writeFile(DATA, JSON.stringify(players), () => {});
}, 3000);

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 10000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/api/scores') {
    const list = Object.entries(players).map(([id, v]) => ({ id, name: v.name, p: v.p, k: v.k }));
    return send(res, 200, list);
  }

  if (req.method === 'POST' && url.pathname === '/api/tap') {
    const b = await readBody(req);
    const id = String(b.id || '').slice(0, 64);
    const name = String(b.name || '').trim().slice(0, 16);
    if (!id || !name) return send(res, 400, { error: 'bad request' });
    const me = players[id] || (players[id] = { name, p: 0, k: 0 });
    me.name = name;
    // จำกัดจำนวนแตะต่อครั้ง กันโกงแบบง่ายๆ
    me.p += Math.max(0, Math.min(50, parseInt(b.p, 10) || 0));
    me.k += Math.max(0, Math.min(50, parseInt(b.k, 10) || 0));
    dirty = true;
    return send(res, 200, { p: me.p, k: me.k });
  }

  if (req.method === 'POST' && url.pathname === '/api/reset') {
    const b = await readBody(req);
    if (b.key !== ADMIN_KEY) return send(res, 403, { error: 'wrong key' });
    players = {};
    dirty = true;
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log('เปิดที่ http://localhost:' + PORT));
