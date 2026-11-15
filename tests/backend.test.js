'use strict';
/* Tests für backend/Code.gs mit nachgebauten Google-Diensten.  Start: node tests/backend.test.js */
process.env.TZ = 'Europe/Berlin';
const assert = require('assert');
const { createEnv } = require('./gas-mock');

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = new Date();
const day = (n, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, h || 0, m || 0);

const env = createEnv();
const primary = env.addCalendar({ id: 'primary@example.com', name: 'Mein Kalender', primary: true });
const ilias = env.addCalendar({ name: 'ILIAS', owned: false, readOnly: true });
const other = env.addCalendar({ name: 'Kollegen', owned: false, readOnly: true });
env.addEvent(ilias, { title: 'Repetitorium', start: day(1, 17), end: day(1, 19) });
env.addEvent(primary, { title: 'Urlaub', start: day(2), end: day(3), allDay: true });
env.addEvent(primary, { title: 'Abgesagt', start: day(1, 8), end: day(1, 9), myStatus: 'NO' });
env.addEvent(other, { title: 'Fremder Termin', start: day(1, 10), end: day(1, 11) });

const KEY = 'k'.repeat(32);
const range = { from: day(-7).toISOString(), to: day(22).toISOString() };
const sync = (ops, key) => env.post(Object.assign({ action: 'sync', key: key || KEY, ops: ops || [] }, range));
let r;
let passed = 0;
const ok = (name) => { passed += 1; console.log('  ✓ ' + name); };

r = sync([]);
assert.strictEqual(r.ok, false);
assert.strictEqual(r.code, 'unauthorized');
ok('ohne Kopplung kein Zugriff');

r = env.post({ action: 'pair', key: 'kurz' });
assert.strictEqual(r.code, 'bad_key');
r = env.post({ action: 'pair', key: KEY });
assert.ok(r.ok, JSON.stringify(r));
r = env.post({ action: 'pair', key: 'x'.repeat(32) });
assert.strictEqual(r.code, 'already_paired');
r = env.post({ action: 'pair', key: KEY });
assert.ok(r.ok);
ok('Kopplung mit Schlüssel, zweites Gerät abgewiesen, gleicher Schlüssel erneut erlaubt');

const ss = Object.values(env.state.spreadsheets)[0];
assert.deepStrictEqual(ss.sheets.map((s) => s.name), ['Übersicht', 'Module', 'Themen', 'Aufgaben', 'Einstellungen']);
const lern = env.state.calendars.find((c) => c.name === 'Lernplan');
assert.ok(lern, 'Kalender Lernplan fehlt');
env.post({ action: 'pair', key: KEY });
assert.strictEqual(Object.keys(env.state.spreadsheets).length, 1);
assert.strictEqual(env.state.calendars.filter((c) => c.name === 'Lernplan').length, 1);
ok('Tabelle „Studienplaner“ und Kalender „Lernplan“ werden genau einmal angelegt');

const exam = ymd(day(54));
r = sync([
  { op: 'settings.save', settings: { iliasCalendarId: ilias.id, busyCalendarIds: [primary.id, ilias.id], einrichtungFertig: true, 'kaputt-er Schlüssel': 1 } },
  { op: 'module.save', module: { id: 'm_1', nr: 4, name: 'Bilanzsteuerrecht', short: 'Bilanz', color: 'm2', exam, done: false } },
  { op: 'topic.save', topic: { id: 't_1', moduleId: 'm_1', title: 'Rückstellungen', ref: '§ 249 HGB', status: 0, order: 1 } },
  { op: 'topic.save', topic: { id: 't_2', moduleId: 'm_1', title: 'Teilwert', ref: '', status: 2, order: 2 } },
  { op: 'task.save', task: { id: 'a_1', moduleId: 'm_1', title: 'Übungsklausur', due: ymd(day(3)), done: false } },
  { op: 'block.create', block: { id: 'b_1', moduleId: 'm_1', topicId: 't_1', kind: 'neu', start: day(1, 17).toISOString(), end: day(1, 18, 30).toISOString() } },
  { op: 'block.create', block: { id: 'b_2', moduleId: 'm_1', topicId: 't_2', kind: 'wdh', start: day(1, 19).toISOString(), end: day(1, 18).toISOString() } },
  { op: 'unsinn' }
]);
assert.ok(r.ok, JSON.stringify(r));
assert.strictEqual(r.errors.length, 2, JSON.stringify(r.errors));
assert.deepStrictEqual(r.errors.map((e) => e.op), ['block.create', 'unsinn']);
assert.strictEqual(r.data.modules.length, 1);
assert.strictEqual(r.data.modules[0].exam, exam);
assert.ok(r.data.modules[0].examEventId);
assert.strictEqual(r.data.topics.length, 2);
assert.strictEqual(r.data.topics[1].status, 2);
assert.strictEqual(r.data.tasks[0].due, ymd(day(3)));
assert.strictEqual(r.data.settings.einrichtungFertig, true);
assert.ok(!('kaputt-er Schlüssel' in r.data.settings));
ok('Module, Themen, Aufgaben und Einstellungen werden gespeichert; fehlerhafte Änderungen werden gemeldet');

assert.strictEqual(r.cal.blocks.length, 1);
assert.strictEqual(r.cal.blocks[0].title, 'Rückstellungen · Modul 4');
assert.strictEqual(r.cal.blocks[0].kind, 'neu');
assert.ok(r.cal.events.some((e) => e.title === 'Repetitorium'));
assert.ok(r.cal.events.some((e) => e.title === 'Urlaub' && e.allDay && e.startDate === ymd(day(2)) && e.endDate === ymd(day(3))));
assert.ok(!r.cal.events.some((e) => e.title === 'Abgesagt'), 'abgesagte Termine sollen nicht blockieren');
assert.ok(!r.cal.events.some((e) => e.title === 'Fremder Termin'), 'nicht gewählte Kalender werden nicht gelesen');
assert.ok(r.cal.calendars.some((c) => c.id === other.id), 'alle Kalender stehen zur Auswahl');
const examEv = lern.events.find((e) => e.tags.sp_exam === 'm_1');
assert.ok(examEv && examEv.allDay);
assert.strictEqual(ymd(examEv.start), exam);
assert.strictEqual(examEv.title, 'Klausur Modul 4 · Bilanzsteuerrecht');
assert.ok(!r.cal.events.some((e) => e.title.indexOf('Klausur') === 0), 'Klausurtermine nicht doppelt als Termin');
ok('Lernblock, Klausurtermin, ILIAS-Termine und Urlaub kommen richtig aus dem Kalender');

const themen = ss.getSheetByName('Themen').table();
assert.deepStrictEqual(themen[0], ['ID', 'Modul-ID', 'Modul', 'Reihenfolge', 'Thema', 'Fundstelle', 'Status', 'Geändert']);
assert.strictEqual(themen[1][2], 'Modul 4');
assert.strictEqual(themen[2][6], 'wiederholt');
const mods = ss.getSheetByName('Module').table();
assert.strictEqual(mods[1][5], exam, 'Klausurdatum muss als Text in der Tabelle stehen');
const ueb = ss.getSheetByName('Übersicht').table();
assert.strictEqual(ueb[1][0], 'Modul 4');
assert.strictEqual(ueb[1][4], '54');
assert.strictEqual(ueb[1][10], '33 %');
ok('Google-Tabelle ist für Menschen (und Claude) lesbar, inklusive Übersicht');

const b1 = r.cal.blocks[0];
r = sync([
  { op: 'block.update', id: 'b_1', eventId: b1.eventId, start: b1.start, patch: { done: true, prev: 0 } },
  { op: 'topic.save', topic: { id: 't_1', moduleId: 'm_1', title: 'Rückstellungen', ref: '§ 249 HGB', status: 1, order: 1, updated: new Date().toISOString() } }
]);
assert.strictEqual(r.cal.blocks[0].done, true);
assert.strictEqual(r.cal.blocks[0].prev, 0);
assert.ok(r.cal.blocks[0].title.indexOf('✓ ') === 0);
assert.strictEqual(r.data.topics.find((t) => t.id === 't_1').status, 1);
r = sync([{ op: 'block.update', id: 'b_1', start: r.cal.blocks[0].start, patch: { start: day(4, 9, 30).toISOString(), end: day(4, 11).toISOString() } }]);
assert.strictEqual(new Date(r.cal.blocks[0].start).getTime(), day(4, 9, 30).getTime());
ok('Lernblock abhaken und verschieben (auch ohne Termin-ID)');

lern.events = lern.events.filter((e) => !e.tags.sp);
r = sync([{ op: 'block.update', id: 'b_1', start: day(4, 9, 30).toISOString(), patch: { done: false } }, { op: 'block.delete', id: 'b_1', start: day(4, 9, 30).toISOString() }]);
assert.strictEqual(r.errors.length, 0);
assert.strictEqual(r.cal.blocks.length, 0);
ok('im Kalender gelöschte Lernblöcke führen zu keinem Fehler');

r = sync([{ op: 'module.save', module: { id: 'm_1', nr: 4, name: 'Bilanzsteuerrecht II', short: 'Bilanz', color: 'm2', exam: ymd(day(60)), done: false } }]);
const examEv2 = lern.events.find((e) => e.tags.sp_exam === 'm_1');
assert.strictEqual(ymd(examEv2.start), ymd(day(60)));
assert.strictEqual(examEv2.title, 'Klausur Modul 4 · Bilanzsteuerrecht II');
assert.strictEqual(lern.events.filter((e) => e.tags.sp_exam).length, 1);
ok('Klausurtermin folgt Änderungen am Modul');

const sh = ss.getSheetByName('Themen');
const rows = sh.table();
rows.push(['', '', '4', '', 'Pensionsrückstellungen', '§ 6a EStG', 'offen', '']);
sh.clearContents();
sh.getRange(1, 1, rows.length, rows[0].length).setNumberFormat('@').setValues(rows);
r = sync([]);
const neu = r.data.topics.find((t) => t.title === 'Pensionsrückstellungen');
assert.ok(neu && neu.id && neu.moduleId === 'm_1', JSON.stringify(neu));
assert.ok(sh.table().some((row) => row[4] === 'Pensionsrückstellungen' && row[0]), 'neue ID wird in die Tabelle geschrieben');
ok('am PC in der Tabelle ergänzte Themen werden übernommen');

r = sync([{ op: 'module.delete', id: 'm_1' }]);
assert.strictEqual(r.data.modules.length, 0);
assert.strictEqual(r.data.topics.length, 0);
assert.strictEqual(r.data.tasks.length, 0);
assert.ok(!lern.events.some((e) => e.tags.sp_exam));
ok('Modul löschen entfernt Themen, Aufgaben und Klausurtermin');

r = sync([], 'falsch');
assert.strictEqual(r.code, 'unauthorized');
r = env.post('{kaputt');
assert.strictEqual(r.ok, false);
const g = JSON.parse(env.gs.doGet().getContent());
assert.ok(g.ok && g.version >= 1);
ok('falscher Schlüssel, kaputte Anfrage und Statusseite');

env.gs.verbindungZuruecksetzen();
r = env.post({ action: 'pair', key: 'y'.repeat(32) });
assert.ok(r.ok);
ok('verbindungZuruecksetzen erlaubt eine neue Kopplung');

console.log('Backend-Tests: ' + passed + ' bestanden');
