/**
 * Studienplaner – Google-Skript
 *
 * Dieses Skript verbindet die Studienplaner-App mit deinem Google-Konto:
 *  - Module, Themen, Aufgaben und Einstellungen stehen in der Google-Tabelle „Studienplaner“.
 *  - Lernblöcke und Klausuren stehen im Google Kalender „Lernplan“.
 *  - Termine (z. B. aus ILIAS) und Urlaub liest die App aus deinen Kalendern.
 *
 * Am Code musst du nichts ändern. Die Einrichtung erklärt dir die App.
 *
 * Nützliche Funktionen zum Ausführen im Editor (oben auswählen, dann „Ausführen“):
 *  - einrichtungPruefen:       legt Tabelle und Kalender an und zeigt, ob alles bereit ist
 *  - verbindungZuruecksetzen:  löst die Verbindung zur App, damit du sie neu verbinden kannst
 */

var VERSION = 1;
var TABELLE_NAME = 'Studienplaner';
var KALENDER_NAME = 'Lernplan';
var STATUS = ['offen', 'gelernt', 'wiederholt', 'sitzt'];
var FARBEN = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
var TAG_MS = 24 * 60 * 60 * 1000;

var SCHEMA = {
  'Module': ['ID', 'Nr', 'Name', 'Kurzname', 'Farbe', 'Klausur', 'Abgeschlossen', 'Klausur-Termin-ID'],
  'Themen': ['ID', 'Modul-ID', 'Modul', 'Reihenfolge', 'Thema', 'Fundstelle', 'Status', 'Geändert'],
  'Aufgaben': ['ID', 'Modul-ID', 'Modul', 'Aufgabe', 'Fällig', 'Erledigt'],
  'Einstellungen': ['Schlüssel', 'Wert']
};
var UEBERSICHT_KOPF = ['Modul', 'Name', 'Stand', 'Klausur', 'Tage bis Klausur', 'Themen', 'offen', 'gelernt', 'wiederholt', 'sitzt', 'Fortschritt', 'Offene Aufgaben'];
var BREITEN = {
  'Übersicht': [90, 240, 110, 100, 120, 70, 60, 70, 80, 60, 90, 120],
  'Module': [110, 50, 240, 160, 60, 100, 110, 260],
  'Themen': [110, 110, 80, 90, 300, 200, 90, 170],
  'Aufgaben': [110, 110, 80, 300, 100, 80],
  'Einstellungen': [180, 520]
};


// ---------- Funktionen zum Ausführen im Editor ----------

function einrichtungPruefen() {
  var ss = getSpreadsheet_();
  var cal = getLernplan_();
  Logger.log('Alles bereit. Tabelle: ' + ss.getUrl() + ' · Kalender: ' + cal.getName());
}

function verbindungZuruecksetzen() {
  props_().deleteProperty('API_KEY');
  Logger.log('Die Verbindung wurde gelöst. Du kannst die App jetzt neu verbinden.');
}


// ---------- Web-App ----------

function doGet() {
  return out_({
    ok: true,
    app: 'Studienplaner',
    version: VERSION,
    hinweis: 'Das Google-Skript läuft. Verbinde es jetzt in der Studienplaner-App.'
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    lock.waitLock(30000);
    locked = true;
    return out_(handle_(req));
  } catch (err) {
    return out_({ ok: false, error: msg_(err) });
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (x) { /* egal */ }
    }
  }
}

function handle_(req) {
  var props = props_();
  var stored = props.getProperty('API_KEY');
  switch (req.action) {
    case 'ping':
      return { ok: true, version: VERSION, paired: !!stored };

    case 'pair':
      if (!req.key || String(req.key).length < 24) {
        return { ok: false, code: 'bad_key', error: 'Ungültiger Schlüssel.' };
      }
      if (stored && stored !== String(req.key)) {
        return {
          ok: false,
          code: 'already_paired',
          error: 'Dieses Google-Skript ist schon mit einem anderen Gerät verbunden. Öffne die App dort, geh in die Einstellungen und tippe auf „Weiteres Gerät verbinden“.'
        };
      }
      getSpreadsheet_();
      getLernplan_();
      if (!stored) props.setProperty('API_KEY', String(req.key));
      return { ok: true, version: VERSION };

    case 'sync':
      if (!stored || String(req.key || '') !== stored) {
        return { ok: false, code: 'unauthorized', error: 'Die App ist nicht mit diesem Google-Skript verbunden.' };
      }
      return sync_(req);

    default:
      return { ok: false, error: 'Unbekannte Anfrage.' };
  }
}

function sync_(req) {
  var ss = getSpreadsheet_();
  var model = loadModel_(ss);
  var ctx = { dirty: model.dirty, cal: null };
  ctx.lernplan = function () {
    if (!ctx.cal) ctx.cal = getLernplan_();
    return ctx.cal;
  };

  var errors = [];
  var ops = Array.isArray(req.ops) ? req.ops : [];
  for (var i = 0; i < ops.length; i++) {
    try {
      applyOp_(ops[i], model, ctx);
    } catch (err) {
      errors.push({ index: i, op: ops[i] && ops[i].op, error: msg_(err) });
    }
  }

  saveModel_(ss, model, ctx.dirty);
  var range = range_(req.from, req.to);
  var cal = loadCalendar_(range.from, range.to, model, ctx.lernplan());
  return {
    ok: true,
    version: VERSION,
    errors: errors,
    data: publicModel_(model),
    cal: cal,
    sheetUrl: ss.getUrl()
  };
}

function range_(from, to) {
  var f = new Date(from);
  var t = new Date(to);
  if (isNaN(f.getTime()) || isNaN(t.getTime()) || t <= f || t - f > 120 * TAG_MS) {
    var now = new Date();
    f = new Date(now.getTime() - 8 * TAG_MS);
    t = new Date(now.getTime() + 30 * TAG_MS);
  }
  return { from: f, to: t };
}


// ---------- Google-Tabelle ----------

function getSpreadsheet_() {
  var props = props_();
  var id = props.getProperty('SHEET_ID');
  var ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(TABELLE_NAME);
    ss.getSheets()[0].setName('Übersicht');
    props.setProperty('SHEET_ID', ss.getId());
  }
  ensureSheets_(ss);
  return ss;
}

function ensureSheets_(ss) {
  var created = false;
  var ov = ss.getSheetByName('Übersicht');
  if (!ov) { ov = ss.insertSheet('Übersicht', 0); }
  if (!ov.getRange(1, 1).getValue()) {
    writeTable_(ov, UEBERSICHT_KOPF, []);
    formatSheet_(ov, 'Übersicht', UEBERSICHT_KOPF.length);
  }
  Object.keys(SCHEMA).forEach(function (name) {
    if (ss.getSheetByName(name)) return;
    var sh = ss.insertSheet(name);
    writeTable_(sh, SCHEMA[name], []);
    formatSheet_(sh, name, SCHEMA[name].length);
    created = true;
  });
  return created;
}

function formatSheet_(sh, name, cols) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, cols).setFontWeight('bold');
  var w = BREITEN[name] || [];
  for (var i = 0; i < w.length; i++) sh.setColumnWidth(i + 1, w[i]);
}

function readTable_(sh) {
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    var empty = true;
    for (var c = 0; c < head.length; c++) {
      var v = row[c];
      if (v !== '' && v !== null && v !== undefined) empty = false;
      obj[head[c]] = v;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function writeTable_(sh, head, rows) {
  var all = [head].concat(rows.map(function (r) { return pad_(r, head.length); }));
  var maxRows = sh.getMaxRows();
  if (maxRows < all.length) sh.insertRowsAfter(maxRows, all.length - maxRows);
  var maxCols = sh.getMaxColumns();
  if (maxCols < head.length) sh.insertColumnsAfter(maxCols, head.length - maxCols);
  sh.clearContents();
  var range = sh.getRange(1, 1, all.length, head.length);
  range.setNumberFormat('@');
  range.setValues(all);
}

function loadModel_(ss) {
  var tz = Session.getScriptTimeZone();
  var dirty = {};

  var modules = readTable_(ss.getSheetByName('Module')).map(function (o) {
    var m = {
      id: cleanId_(o['ID']),
      nr: int_(o['Nr']),
      name: str_(o['Name']),
      short: str_(o['Kurzname']),
      color: FARBEN.indexOf(str_(o['Farbe'])) >= 0 ? str_(o['Farbe']) : 'm1',
      exam: ymd_(o['Klausur'], tz),
      done: yes_(o['Abgeschlossen']),
      examEventId: str_(o['Klausur-Termin-ID'])
    };
    if (!m.short) m.short = m.name;
    return m;
  }).filter(function (m) { return m.id || m.name; });
  modules.forEach(function (m) {
    if (!m.id) { m.id = newId_('m'); dirty.modules = true; }
  });

  var idByNr = {};
  modules.forEach(function (m) { if (m.nr !== null) idByNr[m.nr] = m.id; });

  var topics = readTable_(ss.getSheetByName('Themen')).map(function (o, i) {
    var t = {
      id: cleanId_(o['ID']),
      moduleId: cleanId_(o['Modul-ID']),
      title: str_(o['Thema']),
      ref: str_(o['Fundstelle']),
      status: status_(o['Status']),
      order: num_(o['Reihenfolge'], i + 1),
      updated: str_(o['Geändert'])
    };
    if (!t.moduleId) {
      var nr = int_(String(o['Modul'] || '').replace(/[^0-9]/g, ''));
      if (nr !== null && idByNr[nr]) { t.moduleId = idByNr[nr]; dirty.topics = true; }
    }
    if (!t.id && t.title) { t.id = newId_('t'); dirty.topics = true; }
    return t;
  }).filter(function (t) { return t.id || t.title; });

  var tasks = readTable_(ss.getSheetByName('Aufgaben')).map(function (o) {
    var a = {
      id: cleanId_(o['ID']),
      moduleId: cleanId_(o['Modul-ID']),
      title: str_(o['Aufgabe']),
      due: ymd_(o['Fällig'], tz),
      done: yes_(o['Erledigt'])
    };
    if (!a.moduleId) {
      var nr = int_(String(o['Modul'] || '').replace(/[^0-9]/g, ''));
      if (nr !== null && idByNr[nr]) { a.moduleId = idByNr[nr]; dirty.tasks = true; }
    }
    if (!a.id && a.title) { a.id = newId_('a'); dirty.tasks = true; }
    return a;
  }).filter(function (a) { return a.id || a.title; });

  var settings = {};
  readTable_(ss.getSheetByName('Einstellungen')).forEach(function (o) {
    var k = str_(o['Schlüssel']);
    if (!k) return;
    var v = o['Wert'];
    try { settings[k] = JSON.parse(String(v)); } catch (e) { settings[k] = v; }
  });

  return { modules: modules, topics: topics, tasks: tasks, settings: settings, dirty: dirty };
}

function saveModel_(ss, M, dirty) {
  if (dirty.modules) { dirty.topics = true; dirty.tasks = true; }
  var nrOf = {};
  M.modules.forEach(function (m) { nrOf[m.id] = m.nr; });
  var label = function (id) { return nrOf[id] !== undefined && nrOf[id] !== null ? 'Modul ' + nrOf[id] : ''; };
  var rank = function (id) { return nrOf[id] !== undefined && nrOf[id] !== null ? nrOf[id] : 9999; };

  if (dirty.modules) {
    writeTable_(ss.getSheetByName('Module'), SCHEMA['Module'], M.modules.slice().sort(byNr_).map(function (m) {
      return [m.id, m.nr === null ? '' : String(m.nr), m.name, m.short, m.color, m.exam, m.done ? 'ja' : 'nein', m.examEventId || ''];
    }));
  }
  if (dirty.topics) {
    writeTable_(ss.getSheetByName('Themen'), SCHEMA['Themen'], M.topics.slice().sort(function (a, b) {
      return (rank(a.moduleId) - rank(b.moduleId)) || (a.order - b.order);
    }).map(function (t) {
      return [t.id, t.moduleId, label(t.moduleId), String(t.order), t.title, t.ref, STATUS[t.status] || 'offen', t.updated || ''];
    }));
  }
  if (dirty.tasks) {
    writeTable_(ss.getSheetByName('Aufgaben'), SCHEMA['Aufgaben'], M.tasks.slice().sort(function (a, b) {
      return String(a.due || '9999').localeCompare(String(b.due || '9999'));
    }).map(function (a) {
      return [a.id, a.moduleId, label(a.moduleId), a.title, a.due, a.done ? 'ja' : 'nein'];
    }));
  }
  if (dirty.settings) {
    writeTable_(ss.getSheetByName('Einstellungen'), SCHEMA['Einstellungen'], Object.keys(M.settings).sort().map(function (k) {
      return [k, JSON.stringify(M.settings[k])];
    }));
  }
  if (dirty.modules || dirty.topics || dirty.tasks) writeOverview_(ss, M);
}

function writeOverview_(ss, M) {
  var tz = Session.getScriptTimeZone();
  var heute = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var rows = M.modules.slice().sort(byNr_).map(function (m) {
    var ts = M.topics.filter(function (t) { return t.moduleId === m.id; });
    var c = [0, 0, 0, 0];
    ts.forEach(function (t) { c[t.status] += 1; });
    var tage = m.exam ? String(dayNum_(m.exam) - dayNum_(heute)) : '';
    var sum = ts.reduce(function (a, t) { return a + t.status; }, 0);
    var fortschritt = ts.length ? Math.round(sum / (3 * ts.length) * 100) + ' %' : '';
    var offen = M.tasks.filter(function (a) { return a.moduleId === m.id && !a.done; }).length;
    return ['Modul ' + (m.nr === null ? '?' : m.nr), m.name, m.done ? 'abgeschlossen' : 'läuft', m.exam, tage,
      String(ts.length), String(c[0]), String(c[1]), String(c[2]), String(c[3]), fortschritt, String(offen)];
  });
  rows.push([]);
  rows.push(['Stand: ' + Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy, HH:mm') + ' Uhr']);
  rows.push(['Diese Tabelle gehört zur Studienplaner-App. Ändere Inhalte am besten in der App.']);
  writeTable_(ss.getSheetByName('Übersicht'), UEBERSICHT_KOPF, rows);
}

function publicModel_(M) {
  return { modules: M.modules, topics: M.topics, tasks: M.tasks, settings: M.settings };
}


// ---------- Änderungen aus der App ----------

function applyOp_(op, M, ctx) {
  if (!op || typeof op !== 'object') throw new Error('Leere Änderung.');
  switch (op.op) {
    case 'module.save': return saveModule_(op.module || {}, M, ctx);
    case 'module.delete': return deleteModule_(cleanId_(op.id), M, ctx);
    case 'topic.save': return saveTopic_(op.topic || {}, M, ctx);
    case 'topic.delete':
      M.topics = M.topics.filter(function (t) { return t.id !== cleanId_(op.id); });
      ctx.dirty.topics = true;
      return;
    case 'task.save': return saveTask_(op.task || {}, M, ctx);
    case 'task.delete':
      M.tasks = M.tasks.filter(function (a) { return a.id !== cleanId_(op.id); });
      ctx.dirty.tasks = true;
      return;
    case 'settings.save':
      M.settings = cleanSettings_(op.settings);
      ctx.dirty.settings = true;
      return;
    case 'block.create': return createBlock_(op.block || {}, M, ctx);
    case 'block.update': return updateBlock_(op, M, ctx);
    case 'block.delete': return deleteBlock_(op, ctx);
    default: throw new Error('Unbekannte Änderung: ' + op.op);
  }
}

function saveModule_(m, M, ctx) {
  var id = cleanId_(m.id);
  if (!id) throw new Error('Modul ohne ID.');
  var name = text_(m.name, 120);
  if (!name) throw new Error('Das Modul braucht einen Namen.');
  var rec = find_(M.modules, id);
  var before = rec ? { exam: rec.exam, name: rec.name, nr: rec.nr, eventId: rec.examEventId } : null;
  if (!rec) {
    rec = { id: id, examEventId: '' };
    M.modules.push(rec);
  }
  rec.nr = int_(m.nr);
  rec.name = name;
  rec.short = text_(m.short, 60) || name;
  rec.color = FARBEN.indexOf(m.color) >= 0 ? m.color : 'm1';
  rec.exam = /^\d{4}-\d{2}-\d{2}$/.test(String(m.exam || '')) ? String(m.exam) : '';
  rec.done = !!m.done;
  ctx.dirty.modules = true;
  var changed = !before || before.exam !== rec.exam || before.name !== rec.name || before.nr !== rec.nr || !before.eventId;
  if (changed && (rec.exam || rec.examEventId)) syncExam_(rec, ctx);
}

function deleteModule_(id, M, ctx) {
  var rec = find_(M.modules, id);
  if (!rec) return;
  if (rec.examEventId) {
    try {
      var ev = ctx.lernplan().getEventById(rec.examEventId);
      if (ev) ev.deleteEvent();
    } catch (e) { /* Termin schon weg */ }
  }
  M.modules = M.modules.filter(function (m) { return m.id !== id; });
  M.topics = M.topics.filter(function (t) { return t.moduleId !== id; });
  M.tasks = M.tasks.filter(function (a) { return a.moduleId !== id; });
  ctx.dirty.modules = true;
}

function saveTopic_(t, M, ctx) {
  var id = cleanId_(t.id);
  if (!id) throw new Error('Thema ohne ID.');
  var title = text_(t.title, 200);
  if (!title) throw new Error('Das Thema braucht einen Titel.');
  var rec = find_(M.topics, id);
  if (!rec) {
    rec = { id: id, order: M.topics.length + 1, updated: '' };
    M.topics.push(rec);
  }
  rec.moduleId = cleanId_(t.moduleId) || rec.moduleId || '';
  rec.title = title;
  rec.ref = text_(t.ref, 120);
  rec.status = status_(t.status);
  rec.order = num_(t.order, rec.order);
  rec.updated = text_(t.updated, 40) || rec.updated || '';
  ctx.dirty.topics = true;
}

function saveTask_(a, M, ctx) {
  var id = cleanId_(a.id);
  if (!id) throw new Error('Aufgabe ohne ID.');
  var title = text_(a.title, 200);
  if (!title) throw new Error('Die Aufgabe braucht einen Titel.');
  var rec = find_(M.tasks, id);
  if (!rec) {
    rec = { id: id };
    M.tasks.push(rec);
  }
  rec.moduleId = cleanId_(a.moduleId) || rec.moduleId || '';
  rec.title = title;
  rec.due = /^\d{4}-\d{2}-\d{2}$/.test(String(a.due || '')) ? String(a.due) : '';
  rec.done = !!a.done;
  ctx.dirty.tasks = true;
}

function cleanSettings_(s) {
  var out = {};
  if (!s || typeof s !== 'object' || Array.isArray(s)) return out;
  Object.keys(s).forEach(function (k) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) return;
    var json = JSON.stringify(s[k]);
    if (json === undefined || json.length > 5000) return;
    out[k] = JSON.parse(json);
  });
  return out;
}


// ---------- Kalender ----------

function getLernplan_() {
  var props = props_();
  var id = props.getProperty('CAL_ID');
  var cal = null;
  if (id) {
    try { cal = CalendarApp.getCalendarById(id); } catch (e) { cal = null; }
  }
  if (!cal) {
    var own = CalendarApp.getCalendarsByName(KALENDER_NAME).filter(function (c) {
      return tryGet_(function () { return c.isOwnedByMe(); }, false);
    });
    cal = own.length ? own[0] : CalendarApp.createCalendar(KALENDER_NAME, {
      summary: 'Lernblöcke und Klausuren aus dem Studienplaner'
    });
    props.setProperty('CAL_ID', cal.getId());
  }
  return cal;
}

function syncExam_(m, ctx) {
  var cal = ctx.lernplan();
  var ev = null;
  if (m.examEventId) {
    try { ev = cal.getEventById(m.examEventId); } catch (e) { ev = null; }
  }
  if (!m.exam) {
    if (ev) ev.deleteEvent();
    m.examEventId = '';
    return;
  }
  var tz = Session.getScriptTimeZone();
  var day = Utilities.parseDate(m.exam + ' 12:00', tz, 'yyyy-MM-dd HH:mm');
  var title = 'Klausur Modul ' + (m.nr === null ? '' : m.nr + ' ') + '· ' + m.name;
  if (ev) {
    ev.setAllDayDate(day);
    ev.setTitle(title);
  } else {
    ev = cal.createAllDayEvent(title, day, { description: 'Klausurtermin aus dem Studienplaner.' });
    ev.setTag('sp_exam', m.id);
    m.examEventId = ev.getId();
  }
}

function blockText_(tag, M) {
  var t = find_(M.topics, tag.t);
  var m = find_(M.modules, tag.m);
  var thema = t ? t.title : 'Lernblock';
  var title = (tag.d ? '✓ ' : '') + thema + (m ? ' · Modul ' + m.nr : '');
  var lines = ['Lernblock aus dem Studienplaner'];
  if (m) lines.push('Modul ' + m.nr + ' · ' + m.name);
  if (t) lines.push('Thema: ' + t.title + (t.ref ? ' (' + t.ref + ')' : ''));
  lines.push('Art: ' + (tag.k === 'wdh' ? 'Wiederholen' : 'Neu lernen'));
  if (tag.d) lines.push('Erledigt');
  return { title: title, description: lines.join('\n') };
}

function createBlock_(b, M, ctx) {
  var id = cleanId_(b.id);
  if (!id) throw new Error('Lernblock ohne ID.');
  var s = new Date(b.start);
  var e = new Date(b.end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) throw new Error('Ungültige Zeit für den Lernblock.');
  var tag = { id: id, m: cleanId_(b.moduleId), t: cleanId_(b.topicId), k: b.kind === 'wdh' ? 'wdh' : 'neu', d: b.done ? 1 : 0, p: null };
  var txt = blockText_(tag, M);
  var ev = ctx.lernplan().createEvent(txt.title, s, e, { description: txt.description });
  ev.setTag('sp', JSON.stringify(tag));
}

function updateBlock_(op, M, ctx) {
  var ev = findBlock_(op, ctx);
  if (!ev) return; // im Kalender gelöscht
  var tag = readTag_(ev) || { id: cleanId_(op.id) };
  var p = op.patch || {};
  if (p.start && p.end) {
    var s = new Date(p.start);
    var e = new Date(p.end);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) ev.setTime(s, e);
  }
  if (p.done !== undefined) tag.d = p.done ? 1 : 0;
  if (p.prev !== undefined) tag.p = (p.prev === null || p.prev === undefined) ? null : status_(p.prev);
  if (p.topicId) tag.t = cleanId_(p.topicId);
  if (p.moduleId) tag.m = cleanId_(p.moduleId);
  if (p.kind) tag.k = p.kind === 'wdh' ? 'wdh' : 'neu';
  var txt = blockText_(tag, M);
  ev.setTitle(txt.title);
  ev.setDescription(txt.description);
  ev.setTag('sp', JSON.stringify(tag));
}

function deleteBlock_(op, ctx) {
  var ev = findBlock_(op, ctx);
  if (ev) ev.deleteEvent();
}

function findBlock_(op, ctx) {
  var cal = ctx.lernplan();
  var id = cleanId_(op.id);
  if (op.eventId) {
    try {
      var ev = cal.getEventById(String(op.eventId));
      var t = ev ? readTag_(ev) : null;
      if (ev && (!t || !id || t.id === id)) return ev;
    } catch (e) { /* weiter suchen */ }
  }
  if (!id) return null;
  var center = new Date(op.start || Date.now());
  if (isNaN(center.getTime())) center = new Date();
  var list = cal.getEvents(new Date(center.getTime() - 3 * TAG_MS), new Date(center.getTime() + 3 * TAG_MS));
  for (var i = 0; i < list.length; i++) {
    var tag = readTag_(list[i]);
    if (tag && tag.id === id) return list[i];
  }
  return null;
}

function readTag_(ev) {
  var s = tryGet_(function () { return ev.getTag('sp'); }, null);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

function loadCalendar_(from, to, M, lern) {
  var tz = Session.getScriptTimeZone();
  var lernId = lern.getId();
  var primaryId = CalendarApp.getDefaultCalendar().getId();
  var s = M.settings || {};
  var wanted = {};
  wanted[primaryId] = true;
  wanted[lernId] = true;
  if (s.iliasCalendarId) wanted[s.iliasCalendarId] = true;
  if (Array.isArray(s.busyCalendarIds)) s.busyCalendarIds.forEach(function (id) { wanted[id] = true; });

  var calendars = [];
  var events = [];
  var blocks = [];
  var seen = {};

  var readCal = function (cal) {
    var id = cal.getId();
    if (seen[id]) return;
    seen[id] = true;
    calendars.push({
      id: id,
      name: tryGet_(function () { return cal.getName(); }, id),
      color: tryGet_(function () { return cal.getColor(); }, ''),
      primary: id === primaryId,
      lernplan: id === lernId,
      owned: tryGet_(function () { return cal.isOwnedByMe(); }, false)
    });
    if (!wanted[id]) return;
    var list = tryGet_(function () { return cal.getEvents(from, to); }, []);
    list.forEach(function (ev) {
      if (id === lernId) {
        var tag = readTag_(ev);
        if (tag && tag.id) {
          blocks.push({
            id: String(tag.id),
            eventId: ev.getId(),
            title: ev.getTitle(),
            start: ev.getStartTime().toISOString(),
            end: ev.getEndTime().toISOString(),
            moduleId: tag.m || '',
            topicId: tag.t || '',
            kind: tag.k === 'wdh' ? 'wdh' : 'neu',
            done: !!tag.d,
            prev: (tag.p === null || tag.p === undefined) ? null : tag.p
          });
          return;
        }
        if (tryGet_(function () { return ev.getTag('sp_exam'); }, null)) return;
      }
      var declined = tryGet_(function () { return ev.getMyStatus() === CalendarApp.GuestStatus.NO; }, false);
      if (declined) return;
      var o = { calId: id, title: tryGet_(function () { return ev.getTitle(); }, '') };
      if (ev.isAllDayEvent()) {
        o.allDay = true;
        o.startDate = Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd');
        o.endDate = Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd');
      } else {
        o.start = ev.getStartTime().toISOString();
        o.end = ev.getEndTime().toISOString();
      }
      events.push(o);
    });
  };

  CalendarApp.getAllCalendars().forEach(readCal);
  readCal(lern); // falls der neue Kalender noch nicht in der Liste auftaucht

  return {
    calendars: calendars,
    events: events,
    blocks: blocks,
    lernplanId: lernId,
    primaryId: primaryId,
    tz: tz,
    from: from.toISOString(),
    to: to.toISOString()
  };
}


// ---------- Hilfsfunktionen ----------

function props_() { return PropertiesService.getScriptProperties(); }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function msg_(err) { return String((err && err.message) || err); }

function tryGet_(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function text_(v, max) { return str_(v).replace(/\s+/g, ' ').slice(0, max); }

function int_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

function num_(v, fallback) {
  var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
  return isNaN(n) ? fallback : n;
}

function yes_(v) {
  if (v === true) return true;
  var s = str_(v).toLowerCase();
  return s === 'ja' || s === 'true' || s === 'x' || s === '1' || s === 'erledigt';
}

function status_(v) {
  if (typeof v === 'number' && v >= 0 && v <= 3) return Math.floor(v);
  var s = str_(v).toLowerCase();
  var i = STATUS.indexOf(s);
  if (i >= 0) return i;
  var n = parseInt(s, 10);
  return (n >= 0 && n <= 3) ? n : 0;
}

function cleanId_(v) {
  var s = str_(v);
  return /^[A-Za-z0-9_-]{1,60}$/.test(s) ? s : '';
}

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function ymd_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function dayNum_(ymd) {
  var p = ymd.split('-');
  return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / TAG_MS);
}

function find_(list, id) {
  if (!id) return null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function byNr_(a, b) {
  var x = a.nr === null ? 9999 : a.nr;
  var y = b.nr === null ? 9999 : b.nr;
  return x - y;
}

function pad_(row, n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push(row[i] === undefined || row[i] === null ? '' : row[i]);
  return r;
}
