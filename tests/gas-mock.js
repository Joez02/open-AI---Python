'use strict';
/*
 * Nachbau der Google-Apps-Script-Dienste, die backend/Code.gs benutzt.
 * Damit lässt sich das echte Skript lokal ausführen und testen.
 * Wichtig: Den Prozess mit TZ=Europe/Berlin starten (die Tests tun das).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createEnv(opts) {
  const o = opts || {};
  const state = { props: {}, spreadsheets: {}, calendars: [], nextId: 1, log: [] };

  // ----- Utilities & Session -----
  function parts(date, timeZone) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const p = {};
    f.formatToParts(date).forEach((x) => { p[x.type] = x.value; });
    return p;
  }
  const Utilities = {
    getUuid: () => crypto.randomUUID(),
    formatDate(date, timeZone, pattern) {
      if (!(date instanceof Date) || isNaN(date.getTime())) throw new Error('formatDate: ungültiges Datum');
      const p = parts(date, timeZone);
      const map = { yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second };
      return pattern.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss/g, (m, lit) => (lit !== undefined ? lit : map[m]));
    },
    parseDate(str, timeZone, pattern) {
      const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(String(str));
      if (!m) throw new Error('parseDate: Format nicht unterstützt: ' + str + ' / ' + pattern);
      return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    },
    sleep() {}
  };
  const Session = { getScriptTimeZone: () => 'Europe/Berlin' };
  const Logger = { log: (...a) => state.log.push(a.join(' ')) };
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (Object.prototype.hasOwnProperty.call(state.props, k) ? state.props[k] : null),
      setProperty: (k, v) => { state.props[k] = String(v); },
      deleteProperty: (k) => { delete state.props[k]; }
    })
  };
  const LockService = { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }) };
  const ContentService = {
    MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
    createTextOutput(s) { return { content: s, setMimeType() { return this; }, getContent() { return this.content; } }; }
  };

  // ----- Tabellen -----
  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc, text: false }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        for (let j = 0; j < this.nc; j++) {
          const v = (this.sheet.cells[this.r - 1 + i] || [])[this.c - 1 + j];
          row.push(v === undefined || v === null ? '' : v);
        }
        out.push(row);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(vals) {
      if (!Array.isArray(vals) || vals.length !== this.nr || vals.some((r) => !Array.isArray(r) || r.length !== this.nc)) {
        throw new Error('Die Anzahl der Zeilen oder Spalten passt nicht zum Bereich.');
      }
      if (this.r - 1 + this.nr > this.sheet.maxRows || this.c - 1 + this.nc > this.sheet.maxCols) {
        throw new Error('Die Koordinaten des Bereichs liegen außerhalb des Tabellenblatts.');
      }
      vals.forEach((row, i) => {
        const rr = this.r - 1 + i;
        this.sheet.cells[rr] = this.sheet.cells[rr] || [];
        row.forEach((v, j) => {
          let val = v;
          // Ohne Textformat würde Google ein ISO-Datum in ein Datum umwandeln – das simulieren wir.
          if (!this.text && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const [y, m, d] = v.split('-').map(Number);
            val = new Date(y, m - 1, d);
          }
          this.sheet.cells[rr][this.c - 1 + j] = val;
        });
      });
      return this;
    }
    setNumberFormat(f) { if (f === '@') this.text = true; return this; }
    setFontWeight() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.cells = []; this.maxRows = 1000; this.maxCols = 26; this.frozen = 0; }
    getName() { return this.name; }
    setName(n) { this.name = n; return this; }
    getRange(r, c, nr, nc) {
      if (typeof r === 'string') throw new Error('A1-Notation wird im Nachbau nicht unterstützt.');
      return new Range(this, r, c, nr || 1, nc || 1);
    }
    getLastRow() {
      let last = 0;
      this.cells.forEach((row, i) => { if (row && row.some((v) => v !== '' && v !== undefined && v !== null)) last = i + 1; });
      return last;
    }
    getLastColumn() {
      let last = 0;
      this.cells.forEach((row) => (row || []).forEach((v, j) => { if (v !== '' && v !== undefined && v !== null) last = Math.max(last, j + 1); }));
      return last;
    }
    getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return this.maxCols; }
    insertRowsAfter(after, n) { this.maxRows += n; return this; }
    insertColumnsAfter(after, n) { this.maxCols += n; return this; }
    clearContents() { this.cells = []; return this; }
    setFrozenRows(n) { this.frozen = n; return this; }
    setColumnWidth() { return this; }
    table() { return this.getDataRange().getValues(); }
  }
  class Spreadsheet {
    constructor(name) { this.id = 'ss' + (state.nextId++); this.name = name; this.sheets = [new Sheet('Tabellenblatt1')]; }
    getId() { return this.id; }
    getName() { return this.name; }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
    getSheets() { return this.sheets.slice(); }
    getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
    insertSheet(name, index) {
      if (this.getSheetByName(name)) throw new Error('Ein Tabellenblatt mit dem Namen „' + name + '“ existiert bereits.');
      const s = new Sheet(name);
      if (typeof index === 'number') this.sheets.splice(index, 0, s); else this.sheets.push(s);
      return s;
    }
    deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  }
  const SpreadsheetApp = {
    create(name) { const ss = new Spreadsheet(name); state.spreadsheets[ss.id] = ss; return ss; },
    openById(id) { const ss = state.spreadsheets[id]; if (!ss) throw new Error('Datei nicht gefunden: ' + id); return ss; },
    flush() {}
  };

  // ----- Kalender -----
  const GuestStatus = { INVITED: 'INVITED', MAYBE: 'MAYBE', NO: 'NO', OWNER: 'OWNER', YES: 'YES' };
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  class CalEvent {
    constructor(cal, e) {
      this.cal = cal;
      this.id = 'ev' + (state.nextId++) + '@google.com';
      this.title = e.title;
      this.start = new Date(e.start);
      this.end = new Date(e.end);
      this.allDay = !!e.allDay;
      this.description = e.description || '';
      this.tags = {};
      this.myStatus = e.myStatus || GuestStatus.OWNER;
    }
    getId() { return this.id; }
    getTitle() { return this.title; }
    setTitle(t) { this.title = String(t); return this; }
    getDescription() { return this.description; }
    setDescription(d) { this.description = String(d); return this; }
    getStartTime() { return new Date(this.start); }
    getEndTime() { return new Date(this.end); }
    setTime(s, e) {
      if (!(s instanceof Date) || !(e instanceof Date) || !(e > s)) throw new Error('setTime: ungültige Zeiten');
      this.start = new Date(s); this.end = new Date(e); this.allDay = false; return this;
    }
    isAllDayEvent() { return this.allDay; }
    getAllDayStartDate() { if (!this.allDay) throw new Error('Kein ganztägiger Termin.'); return new Date(this.start); }
    getAllDayEndDate() { if (!this.allDay) throw new Error('Kein ganztägiger Termin.'); return new Date(this.end); }
    setAllDayDate(d) { const s = midnight(d); this.start = s; this.end = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1); this.allDay = true; return this; }
    getTag(k) { return Object.prototype.hasOwnProperty.call(this.tags, k) ? this.tags[k] : null; }
    setTag(k, v) { this.tags[k] = String(v); return this; }
    getMyStatus() { return this.myStatus; }
    deleteEvent() { this.cal.events = this.cal.events.filter((x) => x !== this); }
  }
  class Calendar {
    constructor(c) {
      this.id = c.id || ('cal' + (state.nextId++) + '@group.calendar.google.com');
      this.name = c.name;
      this.color = c.color || '#9FC6E7';
      this.owned = c.owned !== false;
      this.primary = !!c.primary;
      this.readOnly = !!c.readOnly;
      this.events = [];
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getColor() { return this.color; }
    isOwnedByMe() { return this.owned; }
    isHidden() { return false; }
    isSelected() { return true; }
    getEvents(s, e) {
      if (!(s instanceof Date) || !(e instanceof Date)) throw new Error('getEvents: Datum erwartet');
      return this.events.filter((ev) => ev.start < e && ev.end > s).sort((a, b) => a.start - b.start);
    }
    createEvent(title, s, e, opts) {
      if (this.readOnly) throw new Error('Dieser Kalender ist schreibgeschützt.');
      if (!(s instanceof Date) || !(e instanceof Date) || !(e > s)) throw new Error('createEvent: ungültige Zeiten');
      const ev = new CalEvent(this, { title, start: s, end: e, description: (opts || {}).description });
      this.events.push(ev);
      return ev;
    }
    createAllDayEvent(title, date, opts) {
      if (this.readOnly) throw new Error('Dieser Kalender ist schreibgeschützt.');
      const s = midnight(date);
      const ev = new CalEvent(this, { title, start: s, end: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1), allDay: true, description: (opts || {}).description });
      this.events.push(ev);
      return ev;
    }
    getEventById(id) { return this.events.find((x) => x.id === id) || null; }
  }
  const CalendarApp = {
    GuestStatus,
    getAllCalendars: () => state.calendars.slice(),
    getCalendarById: (id) => state.calendars.find((c) => c.id === id) || null,
    getCalendarsByName: (n) => state.calendars.filter((c) => c.name === n),
    getDefaultCalendar: () => state.calendars.find((c) => c.primary),
    createCalendar(name) { const c = new Calendar({ name }); state.calendars.push(c); return c; }
  };

  // ----- Skript laden -----
  const code = fs.readFileSync(o.codePath || path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8');
  const globals = { SpreadsheetApp, CalendarApp, PropertiesService, LockService, Utilities, Session, ContentService, Logger };
  const names = Object.keys(globals);
  const exported = ['doGet', 'doPost', 'einrichtungPruefen', 'verbindungZuruecksetzen'];
  // eslint-disable-next-line no-new-func
  const factory = new Function(...names, code + '\nreturn {' + exported.join(',') + '};');
  const gs = factory(...names.map((n) => globals[n]));

  return {
    gs,
    state,
    addCalendar(c) { const cal = new Calendar(c); state.calendars.push(cal); return cal; },
    addEvent(cal, e) { const ev = new CalEvent(cal, e); cal.events.push(ev); return ev; },
    post(body) {
      const contents = typeof body === 'string' ? body : JSON.stringify(body);
      return JSON.parse(gs.doPost({ postData: { contents, type: 'text/plain' } }).getContent());
    }
  };
}

module.exports = { createEnv };
