'use strict';
/*
 * Lokaler Testserver: liefert die App aus und spielt das Google-Skript (backend/Code.gs)
 * mit nachgebauten Google-Diensten. Start:  TZ=Europe/Berlin node tests/server.js
 * Endpunkte nur für Tests:  GET /__state (Inhalt von Tabelle und Kalendern), POST /__reset
 */
process.env.TZ = process.env.TZ || 'Europe/Berlin';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createEnv } = require('./gas-mock');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const PORT = Number(process.env.PORT || 8787);
const DELAY = Number(process.env.DELAY || 150);

function seed(env) {
  const now = new Date();
  const day = (n, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, h || 0, m || 0);
  const next = (wd, from) => { for (let i = from; i < from + 7; i++) if (day(i).getDay() === wd) return i; return from; };
  const primary = env.addCalendar({ id: 'primary@example.com', name: 'Mein Kalender', primary: true });
  const ilias = env.addCalendar({ name: 'ILIAS Studium', owned: false, readOnly: true });
  const holidays = env.addCalendar({ id: 'de.german#holiday@group.v.calendar.google.com', name: 'Feiertage in Deutschland', owned: false, readOnly: true });
  const thu = next(4, 1), wed = next(3, 1), fri = next(5, 2);
  env.addEvent(ilias, { title: 'Online-Repetitorium Bilanzsteuerrecht', start: day(thu, 17), end: day(thu, 19) });
  env.addEvent(primary, { title: 'Zahnarzt', start: day(wed, 17, 30), end: day(wed, 18, 15) });
  env.addEvent(primary, { title: 'Urlaub', start: day(fri), end: day(fri + 1), allDay: true });
  env.addEvent(primary, { title: 'Abgesagtes Treffen', start: day(1, 17), end: day(1, 18), myStatus: 'NO' });
  env.addEvent(holidays, { title: 'Volkstrauertag', start: day(0), end: day(1), allDay: true });
  return { thu, wed, fri };
}

let env = createEnv();
let seeded = seed(env);

function dump() {
  const st = env.state;
  const sheets = {};
  Object.values(st.spreadsheets).forEach((ss) => ss.sheets.forEach((sh) => { sheets[sh.name] = sh.table(); }));
  return {
    props: st.props,
    seeded,
    sheets,
    calendars: st.calendars.map((c) => ({
      id: c.id,
      name: c.name,
      events: c.events.map((e) => ({ id: e.id, title: e.title, start: e.start.toISOString(), end: e.end.toISOString(), allDay: e.allDay, tags: e.tags, description: e.description }))
    }))
  };
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.gs': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname.endsWith('/exec')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let out;
      try { out = env.post(body || '{}'); } catch (e) { out = { ok: false, error: 'Testserver: ' + String(e && e.message || e) }; }
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(out));
      }, DELAY);
    });
    return;
  }
  if (url.pathname === '/__state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(dump()));
    return;
  }
  if (url.pathname === '/__reset' && req.method === 'POST') {
    env = createEnv();
    seeded = seed(env);
    res.writeHead(200);
    res.end('ok');
    return;
  }
  let file = url.pathname === '/Code.gs' ? path.join(ROOT, 'backend', 'Code.gs') : path.join(APP, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (url.pathname !== '/Code.gs' && !file.startsWith(APP)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Studienplaner-Testserver: http://localhost:' + PORT + '/'));
