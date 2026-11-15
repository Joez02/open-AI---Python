/* Studienplaner – App-Logik. Läuft ohne Build-Werkzeuge direkt im Browser. */
(function () {
  'use strict';

  const APP_VERSION = '1.0.0';
  const NEEDS_BACKEND = 1;
  const DAY = 864e5;
  const MIN_SLOT = 45;
  const STATUS = ['offen', 'gelernt', 'wiederholt', 'sitzt'];
  const COLORS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const DEFAULTS = {
    iliasCalendarId: '',
    busyCalendarIds: null,
    urlaubStichwoerter: ['Urlaub'],
    arbeit: { tage: [1, 2, 3, 4, 5], von: '06:00', bis: '15:30' },
    lernenWerktags: [{ von: '17:00', bis: '18:30' }],
    lernenFrei: [{ von: '09:30', bis: '12:30' }, { von: '14:00', bis: '16:00' }],
    sport: { aktiv: true, tag: 2, von: '18:00', bis: '19:30' },
    klausurphaseWochen: 3,
    tempo: 1.5,
    blockMinuten: 90,
    einrichtungFertig: false
  };

  // ---------- Hilfsfunktionen ----------

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const diffDays = (a, b) => Math.round((sod(a) - sod(b)) / DAY);
  const ymd = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const F = (d, o) => new Intl.DateTimeFormat('de-DE', o).format(d);
  const num = (n, d) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d === undefined ? 1 : d });
  const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const fmtMin = (m) => pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  const at = (day, min) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);
  const minOf = (d) => d.getHours() * 60 + d.getMinutes();
  const hm = (d) => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const durTxt = (min) => num(min / 60) + ' Std.';
  const roundUp15 = (m) => Math.ceil(m / 15) * 15;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clampStatus = (v) => { const n = Math.floor(Number(v)); return n >= 0 && n <= 3 ? n : 0; };
  const trunc = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
  const rand = (len) => Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => (b % 36).toString(36)).join('');
  const uid = (p) => p + '_' + rand(10);
  const dateShort = (d) => F(d, { day: 'numeric', month: 'numeric' });
  const dateLong = (d) => F(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const dayLabel = (d) => {
    const n = diffDays(d, new Date());
    if (n === 0) return 'Heute';
    if (n === 1) return 'Morgen';
    if (n === -1) return 'Gestern';
    return WD[d.getDay()] + ', ' + dateShort(d);
  };
  const appUrl = () => location.origin + location.pathname;
  const isLocal = () => location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

  function ago(ts) {
    if (!ts) return 'noch nie';
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'gerade eben';
    if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' Min.';
    const d = new Date(ts);
    if (diffDays(d, new Date()) === 0) return 'heute, ' + hm(d);
    return dateShort(d) + ', ' + hm(d);
  }

  const ICON = {
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" style="fill:none;stroke:currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" style="fill:none;stroke:currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" style="fill:none;stroke:currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" style="fill:none;stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9.5 6l6 6-6 6" style="fill:none;stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" style="fill:none;stroke:currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="15" cy="7" r="2.2" style="fill:none;stroke:currentColor" stroke-width="1.9"/><circle cx="9" cy="17" r="2.2" style="fill:none;stroke:currentColor" stroke-width="1.9"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4.5 19.5h3.8L19 8.8 15.2 5 4.5 15.7v3.8z" style="fill:none;stroke:currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.4 6.8l3.8 3.8" style="fill:none;stroke:currentColor" stroke-width="1.8"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" style="fill:none;stroke:currentColor" stroke-width="1.8"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" style="fill:none;stroke:currentColor" stroke-width="1.8"/></svg>',
    logo: '<svg class="mark" viewBox="0 0 56 56" aria-hidden="true"><rect width="56" height="56" rx="16" style="fill:var(--ink)"/><circle cx="28" cy="28" r="13" style="fill:none;stroke:var(--bg);stroke-opacity:.28" stroke-width="5"/><circle cx="28" cy="28" r="13" style="fill:none;stroke:var(--bg)" stroke-width="5" stroke-linecap="round" stroke-dasharray="61.3 81.7" transform="rotate(-90 28 28)"/></svg>'
  };

  // ---------- Speicher & Zustand ----------

  const store = {
    get(k, d) { try { const v = localStorage.getItem('sp:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sp:' + k, JSON.stringify(v)); } catch (e) { /* Speicher voll oder gesperrt */ } },
    del(k) { try { localStorage.removeItem('sp:' + k); } catch (e) { /* egal */ } }
  };

  function normData(d) {
    d = d || {};
    return {
      modules: Array.isArray(d.modules) ? d.modules : [],
      topics: Array.isArray(d.topics) ? d.topics : [],
      tasks: Array.isArray(d.tasks) ? d.tasks : [],
      settings: d.settings && typeof d.settings === 'object' && !Array.isArray(d.settings) ? d.settings : {}
    };
  }

  const S = {
    conf: store.get('conf', null),
    data: normData(store.get('data', null)),
    cal: store.get('cal', null),
    outbox: store.get('outbox', []),
    meta: Object.assign({ lastOk: 0, sheetUrl: '', backend: 0 }, store.get('meta', {})),
    sync: { state: 'idle', msg: '' },
    ui: { tab: 'heute', detail: null, dtab: 'themen', page: 0, day: 0, sugg: [], step: 0, drafts: {}, confirm: '', connecting: false, connectErr: '', ilias: undefined, code: '' }
  };

  function persist() {
    store.set('data', S.data);
    store.set('cal', S.cal);
    store.set('outbox', S.outbox);
    store.set('meta', S.meta);
  }

  function cfg() {
    const s = S.data.settings || {};
    const o = {};
    Object.keys(DEFAULTS).forEach((k) => {
      const d = DEFAULTS[k];
      const v = s[k];
      if (v === undefined || v === null) o[k] = d;
      else if (d && typeof d === 'object' && !Array.isArray(d) && typeof v === 'object' && !Array.isArray(v)) o[k] = Object.assign({}, d, v);
      else o[k] = v;
    });
    Object.keys(s).forEach((k) => { if (!(k in o)) o[k] = s[k]; });
    if (!Array.isArray(o.arbeit.tage)) o.arbeit.tage = DEFAULTS.arbeit.tage;
    return o;
  }

  // ---------- Module, Themen, Aufgaben ----------

  const modById = (id) => S.data.modules.find((m) => m.id === id);
  const topicById = (id) => S.data.topics.find((t) => t.id === id);
  const taskById = (id) => S.data.tasks.find((t) => t.id === id);
  const findBlock = (id) => ((S.cal && S.cal.blocks) || []).find((b) => b.id === id);
  const topicsOf = (id) => S.data.topics.filter((t) => t.moduleId === id).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const byDue = (a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999'));
  const tasksOf = (id) => S.data.tasks.filter((t) => t.moduleId === id).sort((a, b) => (a.done - b.done) || byDue(a, b));
  const examOf = (m) => parseYmd(m.exam);
  const modLabel = (m) => 'Modul ' + (m.nr === null || m.nr === undefined || m.nr === '' ? '?' : m.nr);
  const nextOrder = (moduleId) => topicsOf(moduleId).reduce((a, t) => Math.max(a, Number(t.order) || 0), 0) + 1;

  function byExam(a, b) {
    const x = examOf(a), y = examOf(b);
    if (x && y) return x - y;
    if (x) return -1;
    if (y) return 1;
    return (Number(a.nr) || 0) - (Number(b.nr) || 0);
  }
  const activeMods = () => S.data.modules.filter((m) => !m.done).sort(byExam);
  const doneMods = () => S.data.modules.filter((m) => m.done).sort((a, b) => (Number(a.nr) || 0) - (Number(b.nr) || 0));

  function stats(m) {
    const c = cfg();
    const ts = topicsOf(m.id);
    const n = ts.length;
    const counts = [0, 0, 0, 0];
    ts.forEach((t) => { counts[clampStatus(t.status)] += 1; });
    const ex = examOf(m);
    const today = sod(new Date());
    const daysToExam = ex ? diffDays(ex, today) : null;
    const phaseDays = Math.max(0, Number(c.klausurphaseWochen) || 0) * 7;
    const learnDays = ex ? Math.max(0, diffDays(addDays(ex, -phaseDays), today)) : null;
    const weeks = learnDays === null ? null : learnDays / 7;
    const open = counts[0];
    const tempo = Math.max(0.25, Number(c.tempo) || DEFAULTS.tempo);
    let pace = null;
    if (ex) pace = open === 0 ? 0 : (weeks <= 0 ? Infinity : open / weeks);
    let status;
    if (m.done) status = 'done';
    else if (!ex) status = 'nodate';
    else if (daysToExam < 0) status = 'past';
    else if (!n) status = 'empty';
    else status = pace <= tempo ? 'ok' : pace <= tempo * 1.5 ? 'warn' : 'bad';
    const progress = n ? ts.reduce((a, t) => a + clampStatus(t.status), 0) / (3 * n) : 0;
    let latestStart = null;
    if (ex && open > 0) latestStart = addDays(ex, -phaseDays - Math.ceil((open / tempo) * 7));
    const inPhase = !!ex && daysToExam >= 0 && daysToExam <= phaseDays;
    return { n, counts, ex, daysToExam, weeks, open, pace, tempo, status, progress, latestStart, inPhase, phaseDays };
  }
  const paceTxt = (s) => (s.pace === null ? '–' : !s.open ? '0' : isFinite(s.pace) ? num(s.pace) : '–');
  const SLABEL = { ok: 'im Plan', warn: 'knapp', bad: 'hinterher', empty: 'ohne Themen', nodate: 'ohne Datum', past: 'Klausur vorbei', done: 'abgeschlossen' };
  const pill = (cls, label) => `<span class="pill ${cls}">${esc(label)}</span>`;
  const statusPill = (st) => pill(['ok', 'warn', 'bad'].includes(st) ? st : 'neutral', SLABEL[st] || st);

  function alerts(mods) {
    const out = [];
    const today = new Date();
    mods.forEach((m) => {
      const s = stats(m);
      if (s.status === 'bad' || s.status === 'warn') out.push({ m, s, kind: s.status, sev: s.status === 'bad' ? 4 : 3 });
      else if (s.status === 'ok' && s.n > 0 && s.open === s.n && s.latestStart && diffDays(s.latestStart, today) <= 14) out.push({ m, s, kind: 'start', sev: 2 });
      else if (s.status === 'empty' && s.daysToExam <= 150) out.push({ m, s, kind: 'empty', sev: 1 });
    });
    return out.sort((a, b) => (b.sev - a.sev) || (a.s.daysToExam - b.s.daysToExam));
  }
  const weeksTxt = (w) => { const f = Math.floor(w); return f >= 2 ? f + ' Lernwochen' : f === 1 ? '1 Lernwoche' : 'weniger als eine Lernwoche'; };

  // ---------- Kalender: Termine, Urlaub, freie Zeit ----------

  function calIndex() {
    const c = cfg();
    const cal = S.cal || {};
    const cals = cal.calendars || [];
    const primary = cal.primaryId || (cals.find((x) => x.primary) || {}).id;
    const busy = new Set(Array.isArray(c.busyCalendarIds) ? c.busyCalendarIds : [primary]);
    if (c.iliasCalendarId) busy.add(c.iliasCalendarId);
    if (cal.lernplanId) busy.add(cal.lernplanId);
    const calName = (id) => (cals.find((x) => x.id === id) || {}).name || '';
    const kws = (Array.isArray(c.urlaubStichwoerter) ? c.urlaubStichwoerter : []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    const vacation = new Map();
    const timed = [];
    (cal.events || []).forEach((e) => {
      const title = String(e.title || '');
      const isVac = kws.some((k) => title.toLowerCase().includes(k));
      if (e.allDay) {
        if (!isVac) return;
        let d = parseYmd(e.startDate);
        const end = parseYmd(e.endDate);
        for (let i = 0; d && end && d < end && i < 400; i++) { vacation.set(ymd(d), title); d = addDays(d, 1); }
        return;
      }
      const s = new Date(e.start), en = new Date(e.end);
      if (isNaN(s) || isNaN(en)) return;
      if (isVac) {
        let d = sod(s);
        for (let i = 0; d < en && i < 400; i++) { vacation.set(ymd(d), title); d = addDays(d, 1); }
        return;
      }
      if (!busy.has(e.calId)) return;
      timed.push({ title, start: s, end: en, calId: e.calId, ilias: e.calId === c.iliasCalendarId, calName: calName(e.calId) });
    });
    const blocks = ((cal.blocks) || []).map((b) => Object.assign({}, b, { s: new Date(b.start), e: new Date(b.end) })).filter((b) => !isNaN(b.s) && !isNaN(b.e));
    return { c, vacation, timed, blocks };
  }

  function subtract(ranges, cuts) {
    let out = ranges.slice();
    cuts.forEach(([c1, c2]) => {
      const next = [];
      out.forEach(([a, b]) => {
        if (c2 <= a || c1 >= b) { next.push([a, b]); return; }
        if (c1 > a) next.push([a, c1]);
        if (c2 < b) next.push([c2, b]);
      });
      out = next;
    });
    return out;
  }

  function chunk(a, b, max) {
    const len = b - a;
    const n = Math.max(1, Math.round(len / Math.max(MIN_SLOT, max)));
    const size = Math.round(len / n / 15) * 15 || len;
    const out = [];
    let s = a;
    for (let i = 0; i < n; i++) {
      const e = i === n - 1 ? b : Math.min(b, s + size);
      if (e - s >= MIN_SLOT) out.push([s, e]);
      s = e;
    }
    return out;
  }

  const RANK = { fixed: 0, block: 1, sugg: 2, free: 3 };

  function dayModel(day, ix, now) {
    const c = ix.c;
    const key = ymd(day);
    const wd = day.getDay();
    const vacation = ix.vacation.has(key);
    const work = !vacation && (c.arbeit.tage || []).includes(wd);
    const dStart = sod(day), dEnd = addDays(dStart, 1);
    const clipA = (d) => (d <= dStart ? 0 : minOf(d));
    const clipB = (d) => (d >= dEnd ? 1440 : minOf(d));
    const items = [];
    if (work) {
      const a = toMin(c.arbeit.von), b = toMin(c.arbeit.bis);
      if (a !== null && b > a) items.push({ type: 'fixed', kind: 'work', a, b, title: 'Arbeit' });
    }
    if (c.sport && c.sport.aktiv && Number(c.sport.tag) === wd) {
      const a = toMin(c.sport.von), b = toMin(c.sport.bis);
      if (a !== null && b > a) items.push({ type: 'fixed', kind: 'sport', a, b, title: 'Sport', sub: 'Flexibel, lässt sich verschieben' });
    }
    ix.timed.forEach((e) => {
      if (e.start < dEnd && e.end > dStart) items.push({ type: 'fixed', kind: 'event', a: clipA(e.start), b: clipB(e.end), title: e.title || '(ohne Titel)', sub: e.ilias ? 'ILIAS' : e.calName });
    });
    ix.blocks.forEach((bk) => { if (bk.s < dEnd && bk.e > dStart) items.push({ type: 'block', blk: bk, a: clipA(bk.s), b: clipB(bk.e) }); });
    S.ui.sugg.forEach((bk) => { if (bk.s < dEnd && bk.e > dStart) items.push({ type: 'sugg', blk: bk, a: clipA(bk.s), b: clipB(bk.e) }); });
    const busy = items.map((it) => [it.a, it.b]);
    if (dEnd <= now) busy.push([0, 1440]);
    else if (dStart <= now) busy.push([0, Math.min(1440, roundUp15(minOf(now)))]);
    const windows = (work ? c.lernenWerktags : c.lernenFrei) || [];
    let free = [];
    windows.forEach((w) => {
      const a = toMin(w && w.von), b = toMin(w && w.bis);
      if (a === null || b === null || b <= a) return;
      free = free.concat(subtract([[a, b]], busy));
    });
    free.filter(([a, b]) => b - a >= MIN_SLOT).forEach(([a, b]) => items.push({ type: 'free', a, b }));
    items.forEach((it) => { it.start = at(day, it.a); it.end = at(day, it.b); });
    items.sort((x, y) => (x.a - y.a) || (RANK[x.type] - RANK[y.type]));
    return { day, key, wd, vacation, vacTitle: ix.vacation.get(key) || '', work, items };
  }

  function nextSlots(dur, max, ignoreId) {
    const ix = calIndex();
    if (ignoreId) ix.blocks = ix.blocks.filter((b) => b.id !== ignoreId);
    const now = new Date();
    const today = sod(now);
    const out = [];
    for (let i = 0; i < 21 && out.length < max; i++) {
      const day = addDays(today, i);
      dayModel(day, ix, now).items.filter((x) => x.type === 'free').forEach((f) => {
        if (out.length >= max) return;
        const len = Math.min(f.b - f.a, Math.max(MIN_SLOT, dur));
        out.push({ s: at(day, f.a), e: at(day, f.a + len) });
      });
    }
    return out;
  }

  function pageDays() {
    const start = addDays(sod(new Date()), clamp(S.ui.page, 0, 2) * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  function makeSuggestions(days, focusId) {
    const ix = calIndex();
    const c = ix.c;
    const now = new Date();
    S.ui.sugg = [];
    const planned = new Set(ix.blocks.filter((b) => !b.done && b.e > now).map((b) => b.topicId));
    const mods = activeMods().map((m) => ({ m, s: stats(m) })).filter((x) => x.s.n > 0 && x.s.ex && x.s.daysToExam >= 0);
    if (!mods.length) return 0;
    const sev = { bad: 3, warn: 2, ok: 1 };
    const focus = (x) => (x.m.id === focusId ? 1 : 0);
    const newQ = [];
    mods.slice().sort((x, y) => (focus(y) - focus(x)) || ((sev[y.s.status] || 0) - (sev[x.s.status] || 0)) || (x.s.ex - y.s.ex))
      .forEach(({ m }) => topicsOf(m.id).forEach((t) => { if (clampStatus(t.status) === 0 && !planned.has(t.id)) newQ.push({ m, t, kind: 'neu' }); }));
    const revQ = [];
    mods.slice().sort((x, y) => (focus(y) - focus(x)) || (x.s.ex - y.s.ex))
      .forEach(({ m }) => topicsOf(m.id)
        .filter((t) => { const st = clampStatus(t.status); return (st === 1 || st === 2) && !planned.has(t.id); })
        .sort((a, b) => String(a.updated || '').localeCompare(String(b.updated || '')))
        .forEach((t) => revQ.push({ m, t, kind: 'wdh' })));
    const phase = mods.some((x) => x.s.inPhase);
    let n = 0;
    days.forEach((day) => {
      const dm = dayModel(day, ix, now);
      dm.items.filter((x) => x.type === 'free').forEach((f) => chunk(f.a, f.b, Number(c.blockMinuten) || 90).forEach(([a, b]) => {
        const preferRev = phase ? n % 3 !== 2 : n % 2 === 1;
        const pick = preferRev ? (revQ.shift() || newQ.shift()) : (newQ.shift() || revQ.shift());
        if (!pick) return;
        const s = at(day, a), e = at(day, b);
        S.ui.sugg.push({ id: uid('b'), moduleId: pick.m.id, topicId: pick.t.id, kind: pick.kind, start: s.toISOString(), end: e.toISOString(), s, e });
        n += 1;
      }));
    });
    return n;
  }

  function selectFirstSugg() {
    if (!S.ui.sugg.length) return;
    const days = pageDays();
    const first = S.ui.sugg.slice().sort((a, b) => a.s - b.s)[0];
    const i = days.findIndex((d) => ymd(d) === ymd(first.s));
    if (i >= 0) S.ui.day = i;
  }

  // ---------- Änderungen & Abgleich mit Google ----------

  function applyLocal(op) {
    const D = S.data;
    const up = (arr, obj) => { const i = arr.findIndex((x) => x.id === obj.id); if (i >= 0) arr[i] = Object.assign({}, arr[i], obj); else arr.push(Object.assign({}, obj)); };
    const ensureCal = () => { if (!S.cal) S.cal = { calendars: [], events: [], blocks: [] }; if (!S.cal.blocks) S.cal.blocks = []; };
    switch (op.op) {
      case 'module.save': up(D.modules, op.module); break;
      case 'module.delete':
        D.modules = D.modules.filter((m) => m.id !== op.id);
        D.topics = D.topics.filter((t) => t.moduleId !== op.id);
        D.tasks = D.tasks.filter((t) => t.moduleId !== op.id);
        break;
      case 'topic.save': up(D.topics, op.topic); break;
      case 'topic.delete': D.topics = D.topics.filter((t) => t.id !== op.id); break;
      case 'task.save': up(D.tasks, op.task); break;
      case 'task.delete': D.tasks = D.tasks.filter((t) => t.id !== op.id); break;
      case 'settings.save': D.settings = Object.assign({}, op.settings); break;
      case 'block.create': ensureCal(); S.cal.blocks.push(Object.assign({ eventId: '', title: '' }, op.block)); break;
      case 'block.update': { ensureCal(); const b = S.cal.blocks.find((x) => x.id === op.id); if (b) Object.assign(b, op.patch); break; }
      case 'block.delete': ensureCal(); S.cal.blocks = S.cal.blocks.filter((x) => x.id !== op.id); break;
      default: break;
    }
  }

  function mutate(...ops) {
    ops.forEach((op) => { applyLocal(op); S.outbox.push(op); });
    persist();
    render();
    scheduleSync();
  }

  function topicOp(t, patch) {
    const nt = Object.assign({}, t, patch);
    if ('status' in patch) nt.updated = new Date().toISOString();
    return { op: 'topic.save', topic: nt };
  }

  async function rawApi(url, payload) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), signal: ctrl.signal, redirect: 'follow', cache: 'no-store' });
      const text = await res.text();
      try { return JSON.parse(text); } catch (e) {
        throw new Error('Unerwartete Antwort vom Google-Skript. Ist die Web-App-URL richtig und steht „Wer hat Zugriff“ auf „Jeder“?');
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const api = (payload) => rawApi(S.conf.url, Object.assign({ key: S.conf.key, client: APP_VERSION }, payload));

  function netMessage(e) {
    if (e && e.name === 'AbortError') return 'Google hat nicht rechtzeitig geantwortet. Versuch es gleich noch einmal.';
    if (e && e.code) return e.message;
    if (!navigator.onLine) return 'Du bist offline. Verbinde dich mit dem Internet und versuch es erneut.';
    if (e && e.name === 'TypeError') return 'Keine Antwort vom Google-Skript. Prüfe die URL und ob beim Bereitstellen „Wer hat Zugriff: Jeder“ eingestellt ist.';
    return (e && e.message) || 'Unbekannter Fehler.';
  }

  let syncTimer = null;
  let syncing = false;
  let syncAgain = false;
  function scheduleSync(ms) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, ms === undefined ? 1200 : ms);
  }

  async function sync() {
    if (!S.conf) return;
    if (syncing) { syncAgain = true; return; }
    clearTimeout(syncTimer);
    syncing = true;
    S.sync = { state: 'syncing', msg: '' };
    renderSyncLine();
    const batch = S.outbox.slice();
    const today = sod(new Date());
    try {
      const res = await api({ action: 'sync', ops: batch, from: addDays(today, -7).toISOString(), to: addDays(today, 22).toISOString() });
      if (!res || !res.ok) throw Object.assign(new Error((res && res.error) || 'Unbekannter Fehler im Google-Skript.'), { code: (res && res.code) || 'server' });
      S.outbox = S.outbox.slice(batch.length);
      S.data = normData(res.data);
      S.cal = res.cal || null;
      S.outbox.forEach(applyLocal);
      S.meta.lastOk = Date.now();
      S.meta.sheetUrl = res.sheetUrl || S.meta.sheetUrl;
      S.meta.backend = res.version || 0;
      persist();
      S.sync = { state: 'ok', msg: '' };
      if (res.errors && res.errors.length) {
        toast(res.errors.length === 1 ? 'Eine Änderung konnte Google nicht übernehmen: ' + res.errors[0].error : res.errors.length + ' Änderungen konnte Google nicht übernehmen.');
      }
      if (S.ui.tab === 'setup' && cfg().einrichtungFertig) S.ui.tab = 'heute';
    } catch (e) {
      if (e.code === 'unauthorized') S.sync = { state: 'auth', msg: 'Die Verbindung zum Google-Skript ist nicht mehr gültig. Trenne die Verbindung in den Einstellungen und verbinde neu.' };
      else if (!navigator.onLine) S.sync = { state: 'offline', msg: '' };
      else S.sync = { state: 'error', msg: netMessage(e) };
    } finally {
      syncing = false;
      if (formOpen()) renderSyncLine(); else render();
      if (syncAgain || S.outbox.length && S.sync.state === 'ok') { syncAgain = false; scheduleSync(400); }
    }
  }

  const formOpen = () => S.ui.tab === 'einst' || (S.ui.tab === 'setup' && S.ui.step === 4);

  function syncLine() {
    const st = S.sync.state;
    const pending = S.outbox.length;
    const waiting = pending ? pending + (pending > 1 ? ' Änderungen warten' : ' Änderung wartet') : '';
    let dot = 'ok', txt;
    if (st === 'syncing') { dot = 'busy'; txt = 'Gleiche mit Google ab …'; }
    else if (st === 'offline') { dot = 'off'; txt = 'Offline' + (waiting ? ' · ' + waiting : ''); }
    else if (st === 'error') { dot = 'err'; txt = 'Abgleich fehlgeschlagen · erneut versuchen'; }
    else if (st === 'auth') { dot = 'err'; txt = 'Verbindung ungültig · Einstellungen öffnen'; }
    else if (pending) { dot = 'busy'; txt = waiting; }
    else txt = 'Mit Google abgeglichen · ' + ago(S.meta.lastOk);
    return `<button class="sync" id="syncline" data-action="${st === 'auth' ? 'settings' : 'syncNow'}"><span class="sdot ${dot}"></span><span>${esc(txt)}</span></button>`;
  }
  function renderSyncLine() {
    const el = document.getElementById('syncline');
    if (el) el.outerHTML = syncLine();
    const conn = document.getElementById('conn');
    if (conn) conn.innerHTML = connSection();
  }

  // ---------- Bausteine ----------

  function statusRing(s, color, size) {
    const z = size || 24;
    if (s === 3) return `<svg viewBox="0 0 24 24" width="${z}" height="${z}" aria-hidden="true"><circle cx="12" cy="12" r="10.2" style="fill:var(--${color})"/><path d="M7.6 12.4l3 3 5.9-6.2" style="fill:none;stroke:var(--surface)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const r = 9, c = 2 * Math.PI * r;
    const arc = s ? `<circle cx="12" cy="12" r="${r}" style="fill:none;stroke:var(--${color})" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${(c * s / 3).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 12 12)"/>` : '';
    return `<svg viewBox="0 0 24 24" width="${z}" height="${z}" aria-hidden="true"><circle cx="12" cy="12" r="${r}" style="fill:none;stroke:var(--line-2)" stroke-width="2.6"/>${arc}</svg>`;
  }
  const mix = (color, k) => (k === 0 ? 'var(--line)' : `color-mix(in srgb, var(--${color}) ${[0, 32, 64, 100][k]}%, var(--surface))`);
  function sbar(m, s) {
    return `<div class="sbar" role="img" aria-label="${s.counts[3]} sitzen, ${s.counts[2]} wiederholt, ${s.counts[1]} gelernt, ${s.counts[0]} offen">${[3, 2, 1].map((k) => (s.counts[k] ? `<span style="flex-grow:${s.counts[k]};background:${mix(m.color, k)}"></span>` : '')).join('')}${s.counts[0] ? `<span style="flex-grow:${s.counts[0]};background:transparent"></span>` : ''}</div>`;
  }
  const statusLegend = (m, s) => `<div class="legend">${[3, 2, 1, 0].map((k) => `<span><i class="lg" style="background:${mix(m.color, k)}"></i>${STATUS[k]} ${s.counts[k]}</span>`).join('')}</div>`;
  const closeBtn = () => `<button class="iconbtn ghost" data-action="close" aria-label="Schließen">${ICON.close}</button>`;
  const dueLabel = (d) => { const n = diffDays(d, new Date()); return n === 0 ? 'heute' : n === 1 ? 'morgen' : WD[d.getDay()] + ', ' + dateShort(d); };

  function blockInfo(b) {
    const m = modById(b.moduleId);
    const t = topicById(b.topicId);
    const fallback = String(b.title || 'Lernblock').replace(/^✓\s*/, '').replace(/\s·\sModul.*$/, '');
    return { m, t, title: t ? t.title : fallback, color: m ? m.color : 'ink-3', kind: b.kind === 'wdh' ? 'Wiederholen' : 'Neu lernen' };
  }

  function rowHTML(it, dkey) {
    const time = `<div class="tl-time"><span>${hm(it.start)}</span><span>${it.b >= 1440 ? '24:00' : hm(it.end)}</span></div>`;
    if (it.type === 'fixed') {
      return `<div class="tl ${it.kind}">${time}<div class="tl-body"><div class="tl-title"><span class="sw sw-${it.kind}"></span><span class="tx">${esc(it.title)}</span></div>${it.sub ? `<div class="tl-sub">${esc(it.sub)}</div>` : ''}</div><span></span></div>`;
    }
    if (it.type === 'free') {
      return `<button class="tl free" data-action="planSlot" data-day="${dkey}" data-a="${it.a}" data-b="${it.b}">${time}<div class="tl-body"><div class="tl-title">Frei · ${durTxt(it.b - it.a)}</div><div class="tl-sub">Lernblock planen</div></div><span class="plus">${ICON.plus}</span></button>`;
    }
    const b = it.blk;
    const info = blockInfo(b);
    const sub = (info.m ? modLabel(info.m) + ' · ' : '') + info.kind;
    const title = `<div class="tl-title"><span class="dot" style="background:var(--${info.color})"></span><span class="tx">${esc(info.title)}</span></div>`;
    if (it.type === 'sugg') {
      return `<div class="tl block sugg">${time}<button class="tl-body" data-action="openSugg" data-id="${esc(b.id)}">${title}<div class="tl-sub">${esc(sub)}</div></button><span class="pill neutral">Vorschlag</span></div>`;
    }
    return `<div class="tl block ${b.done ? 'done' : ''}">${time}<button class="tl-body" data-action="openBlock" data-id="${esc(b.id)}">${title}<div class="tl-sub">${esc(sub)}${b.eventId ? '' : ' · wird übertragen'}</div></button><button class="check ${b.done ? 'on' : ''}" data-action="toggleDone" data-id="${esc(b.id)}" aria-label="${b.done ? 'Wieder als offen markieren' : 'Als erledigt markieren'}">${ICON.check}</button></div>`;
  }

  function taskRow(t, showMod) {
    const m = modById(t.moduleId);
    const d = parseYmd(t.due);
    const late = d && !t.done && diffDays(d, new Date()) < 0;
    const when = d ? `<span class="${late ? 'overdue' : ''}">${late ? 'überfällig seit ' + dateShort(d) : 'fällig ' + dueLabel(d)}</span>` : 'ohne Datum';
    return `<div class="task ${t.done ? 'done' : ''}"><button class="cbox ${t.done ? 'on' : ''}" data-action="toggleTask" data-id="${esc(t.id)}" aria-label="${t.done ? 'Wieder öffnen' : 'Als erledigt markieren'}">${ICON.check}</button><button class="tl-body" data-action="openTask" data-id="${esc(t.id)}"><div class="tl-title"><span class="tx">${esc(t.title)}</span></div><div class="tl-sub">${showMod && m ? esc(modLabel(m)) + ' · ' : ''}${when}</div></button></div>`;
  }

  // ---------- Ansicht: Einrichtung ----------

  const progressBar = (n) => `<div class="progress" role="img" aria-label="Schritt ${n} von 4">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;

  function viewSetup() {
    if (!S.conf) {
      if (S.ui.step <= 0) return setupWelcome();
      if (S.ui.step === 1) return setupScript();
      return setupConnect();
    }
    if (S.ui.step < 3) S.ui.step = 3;
    return S.ui.step === 3 ? setupCalendar() : setupTimes();
  }

  function setupWelcome() {
    return `<div class="view setup">
      ${ICON.logo}
      <header><div class="eyebrow">Willkommen</div><h1>Studienplaner</h1></header>
      <p class="lead">Lernpläne, Themen und Termine an einem Ort, abgeglichen mit deinem Google Kalender.</p>
      <div class="card"><ul class="bullets">
        <li>Module, Themen und Fortschritt speichert die App in einer Google-Tabelle namens „Studienplaner“.</li>
        <li>Lernblöcke und Klausuren landen in einem eigenen Google Kalender „Lernplan“.</li>
        <li>Alles bleibt in deinem Google-Konto. So kann auch Claude darauf zugreifen, wenn du es erlaubst.</li>
      </ul></div>
      <p class="note">Die Einrichtung dauert etwa 10 Minuten. Den ersten Schritt, das Google-Skript, machst du am einfachsten am PC.</p>
      <div class="sec">
        <button class="btn primary wide" data-action="step" data-step="1">Einrichtung starten</button>
        <button class="btn ghost wide" data-action="step" data-step="2">Ich habe schon eine Web-App-URL</button>
      </div>
    </div>`;
  }

  function setupScript() {
    prefetchCode();
    return `<div class="view setup">
      <button class="back" data-action="step" data-step="0">${ICON.chevL}Zurück</button>
      ${progressBar(1)}
      <header><div class="eyebrow">Schritt 1 von 4</div><h1>Google-Skript anlegen</h1></header>
      <p class="lead">Ein kleines Skript in deinem Google-Konto verbindet die App mit Kalender und Tabelle. Du kopierst es nur hinein, programmieren musst du nichts.</p>
      <div class="row"><button class="btn primary" data-action="copyCode">${ICON.copy} Code kopieren</button><a class="btn" href="https://script.new" target="_blank" rel="noopener">Apps Script öffnen</a></div>
      <ol class="steps">
        <li>Tippe auf <b>Code kopieren</b> und dann auf <b>Apps Script öffnen</b>. Es öffnet sich ein neues, leeres Projekt.</li>
        <li>Lösche den Text im Editor und füge den kopierten Code ein. Klicke oben auf <b>Unbenanntes Projekt</b>, nenne es <b>Studienplaner</b> und speichere mit dem Disketten-Symbol.</li>
        <li>Klicke oben rechts auf <b>Bereitstellen</b> und dann auf <b>Neue Bereitstellung</b>. Wähle beim Zahnrad den Typ <b>Web-App</b>.</li>
        <li>Stelle <b>Ausführen als: Ich</b> und <b>Wer hat Zugriff: Jeder</b> ein und klicke auf <b>Bereitstellen</b>.</li>
        <li>Klicke auf <b>Zugriff autorisieren</b> und wähle dein Google-Konto. Google zeigt „Google hat diese App nicht überprüft“. Das ist normal, denn es ist dein eigenes Skript: Klicke auf <b>Erweitert</b>, dann auf <b>Zu Studienplaner (unsicher) wechseln</b> und auf <b>Zulassen</b>.</li>
        <li>Kopiere die <b>Web-App-URL</b>. Sie endet auf <b>/exec</b>.</li>
      </ol>
      <div class="help"><b>Am PC geht es leichter.</b><span>Öffne dort diese Adresse und mach diesen Schritt im Browser:</span><span class="code">${esc(appUrl())}</span><button class="btn small" data-action="copyText" data-text="${esc(appUrl())}">Adresse kopieren</button></div>
      <button class="btn primary wide" data-action="step" data-step="2">Weiter: URL einfügen</button>
    </div>`;
  }

  function setupConnect() {
    return `<form class="view setup" data-form="connect" novalidate>
      <button type="button" class="back" data-action="step" data-step="1">${ICON.chevL}Zurück</button>
      ${progressBar(2)}
      <header><div class="eyebrow">Schritt 2 von 4</div><h1>Verbinden</h1></header>
      <p class="lead">Füge die Web-App-URL ein, die Google dir nach dem Bereitstellen angezeigt hat.</p>
      <div class="frow"><label for="f-url">Web-App-URL</label><input type="url" id="f-url" data-draft placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.ui.drafts['f-url'] || '')}"></div>
      ${S.ui.connectErr ? `<p class="err">${esc(S.ui.connectErr)}</p>` : ''}
      <button class="btn primary wide" type="submit" ${S.ui.connecting ? 'disabled' : ''}>${S.ui.connecting ? 'Verbinde …' : 'Verbinden'}</button>
      <p class="note">Beim Verbinden vereinbart die App einen geheimen Schlüssel mit deinem Skript. Ohne diesen Schlüssel kann niemand deine Daten abrufen, auch wenn er die Adresse kennt.</p>
      <div class="help"><b>Schon auf einem anderen Gerät eingerichtet?</b><span>Öffne dort die Einstellungen und tippe auf „Weiteres Gerät verbinden“. Mit dem Link oder QR-Code ist dieses Gerät sofort verbunden.</span></div>
    </form>`;
  }

  function setupCalendar() {
    const cals = S.cal && S.cal.calendars ? S.cal.calendars.filter((x) => !x.lernplan) : null;
    if (S.ui.ilias === undefined && cals) {
      const c = cfg();
      const guess = cals.find((x) => /ilias/i.test(x.name));
      S.ui.ilias = c.iliasCalendarId || (guess ? guess.id : '');
    }
    let list;
    if (!cals) {
      list = (S.sync.state === 'error' || S.sync.state === 'auth')
        ? `<p class="err">${esc(S.sync.msg)}</p><button class="btn" data-action="syncNow">Erneut versuchen</button>`
        : '<div class="loading"><span class="spinner"></span>Lade deine Kalender …</div>';
    } else {
      list = `<div class="radio-list">${cals.map((x) => `<label class="radio"><input type="radio" name="f-ilr" value="${esc(x.id)}" ${S.ui.ilias === x.id ? 'checked' : ''}><span>${esc(x.name)}<small>${x.primary ? 'Dein Hauptkalender' : x.owned ? 'Eigener Kalender' : 'Abonniert'}</small></span></label>`).join('')}
        <label class="radio"><input type="radio" name="f-ilr" value="" ${!S.ui.ilias ? 'checked' : ''}><span>Noch keiner<small>Kannst du später in den Einstellungen wählen.</small></span></label></div>`;
    }
    return `<div class="view setup">
      ${progressBar(3)}
      <header><div class="eyebrow">Schritt 3 von 4</div><h1>ILIAS-Kalender</h1></header>
      <p class="lead">Wähle den Kalender, in dem deine ILIAS-Termine stehen. Die App hält diese Zeiten frei und zeigt sie dir an.</p>
      ${list}
      <details class="help"><summary><b>So holst du die ILIAS-Termine in Google Kalender</b></summary>
        <ol class="steps">
          <li>Öffne in ILIAS deinen Kalender und wähle <b>Abonnieren</b> bzw. <b>Kalender abonnieren</b>. Kopiere den angezeigten Link.</li>
          <li>Öffne <b>calendar.google.com</b> am PC. Klicke links neben <b>Weitere Kalender</b> auf <b>+</b> und dann auf <b>Per URL</b>.</li>
          <li>Füge den Link ein und klicke auf <b>Kalender hinzufügen</b>.</li>
          <li>Komm zurück und tippe auf <b>Liste aktualisieren</b>.</li>
        </ol>
        <span class="note">Google aktualisiert abonnierte Kalender nur alle paar Stunden. Neue ILIAS-Termine erscheinen deshalb mit etwas Verzögerung.</span>
      </details>
      <div class="row"><button class="btn" data-action="syncNow">Liste aktualisieren</button><button class="btn primary" data-action="step" data-step="4" ${cals ? '' : 'disabled'}>Weiter</button></div>
    </div>`;
  }

  function setupTimes() {
    return `<form class="view setup" data-form="setupTimes" novalidate>
      <button type="button" class="back" data-action="step" data-step="3">${ICON.chevL}Zurück</button>
      ${progressBar(4)}
      <header><div class="eyebrow">Schritt 4 von 4</div><h1>Deine Zeiten</h1></header>
      <p class="lead">Daraus berechnet die App deine freien Lernfenster. Vorausgefüllt sind Arbeit Mo–Fr 6:00–15:30 und Sport am Dienstag. Passe an, was nicht stimmt.</p>
      <div class="card pad">${formTimes(cfg())}</div>
      <p class="err" id="f-serr" hidden></p>
      <button class="btn primary wide" type="submit">Fertig</button>
    </form>`;
  }

  // ---------- Ansicht: Heute ----------

  function viewHeute() {
    const now = new Date();
    const today = sod(now);
    const ix = calIndex();
    const dm = dayModel(today, ix, now);
    const loading = !S.meta.lastOk && S.sync.state === 'syncing';
    const missed = ix.blocks.filter((b) => !b.done && b.e <= now && b.s >= addDays(today, -7)).sort((a, b) => b.s - a.s);
    const mods = activeMods();
    const lern = dm.items.filter((i) => i.type === 'block').length;
    const ringMods = mods.filter((m) => { const ex = examOf(m); return ex && diffDays(ex, today) >= 0; });
    const bars = weekBars(ix, today);
    const due = S.data.tasks.filter((t) => { const d = parseYmd(t.due); return !t.done && d && diffDays(d, today) <= 14; }).sort(byDue);
    const metaToday = lern ? lern + (lern > 1 ? ' Lernblöcke' : ' Lernblock') : dm.vacation ? 'freier Tag' : 'kein Lernblock';
    return `<div class="view">
      <header class="sh"><div><div class="eyebrow">${WD_LONG[today.getDay()]}</div><h1>${F(today, { day: 'numeric', month: 'long' })}</h1>${syncLine()}</div><button class="iconbtn" data-action="settings" aria-label="Einstellungen">${ICON.sliders}</button></header>
      ${backendNotice()}
      ${loading ? '<div class="loading"><span class="spinner"></span>Lade deine Daten aus Google …</div>' : alertsHTML(mods)}
      ${missed.length ? `<section class="sec"><div class="sec-h"><h2>Verpasst</h2><span class="meta">letzte 7 Tage</span></div><div class="card"><div class="tls">${missed.map(missedRow).join('')}</div></div></section>` : ''}
      <section class="sec"><div class="sec-h"><h2>Heute</h2><span class="meta">${metaToday}</span></div>
        ${dm.items.length ? `<div class="card"><div class="tls">${dm.items.map((it) => rowHTML(it, dm.key)).join('')}</div></div>` : '<p class="empty">Heute steht nichts an, und kein Lernfenster ist mehr frei.</p>'}</section>
      ${ringMods.length ? `<section class="sec"><div class="sec-h"><h2>Klausuren</h2><span class="meta">Tage bis zur Klausur</span></div><div class="rings">${ringMods.map(ringHTML).join('')}</div></section>` : ''}
      <section class="sec"><div class="sec-h"><h2>Lernzeit, nächste 7 Tage</h2><span class="meta">${num(bars.total / 60)} Std. geplant</span></div><div class="bars">${bars.cols}</div><p class="note">Richtwert: werktags 1–2 Std., am Wochenende mehr.</p></section>
      <section class="sec"><div class="sec-h"><h2>Fällige Aufgaben</h2><span class="meta">nächste 14 Tage</span></div>
        ${due.length ? `<div class="card"><div class="tasks">${due.map((t) => taskRow(t, true)).join('')}</div></div>` : '<p class="empty">Keine offenen Aufgaben in den nächsten 14 Tagen.</p>'}</section>
    </div>`;
  }

  function backendNotice() {
    if (!S.meta.backend || S.meta.backend >= NEEDS_BACKEND) return '';
    return `<div class="alert warn"><div class="alert-h"><span class="pill warn">Update nötig</span></div><p><b>Bitte aktualisiere das Google-Skript.</b> Kopiere den neuen Code in deinen Apps-Script-Editor, speichere und wähle „Bereitstellen“, „Bereitstellungen verwalten“, Stift-Symbol, Version „Neue Version“, „Bereitstellen“. Die URL bleibt gleich.</p><button class="btn small" data-action="copyCode">${ICON.copy} Neuen Code kopieren</button></div>`;
  }

  function alertsHTML(mods) {
    if (!S.data.modules.length) {
      return `<div class="alert"><div class="alert-h"><span class="pill neutral">Los geht's</span></div><p><b>Lege dein erstes Modul an.</b> Mit Klausurdatum und Themen kann die App rückwärts planen und dich warnen, bevor es knapp wird.</p><button class="btn primary small" data-action="addModule">Modul anlegen</button></div>`;
    }
    const list = alerts(mods);
    const today = new Date();
    if (!list.length) {
      const next = mods.find((m) => examOf(m) && diffDays(examOf(m), today) >= 0);
      return `<div class="alert"><div class="alert-h"><span class="pill ok">Alles im Plan</span></div><p>${next ? `Nächste Klausur: ${esc(modLabel(next))} · ${esc(next.short || next.name)} in ${diffDays(examOf(next), today)} Tagen.` : 'Gerade steht keine Klausur an.'}</p></div>`;
    }
    const [first, ...rest] = list;
    const more = rest.length ? `<div class="alerts-more">${rest.map((a) => `<button class="alert-mini" data-action="openModule" data-id="${esc(a.m.id)}">${alertPill(a)}<span>${esc(alertShort(a))}</span></button>`).join('')}</div>` : '';
    return alertCard(first) + more;
  }
  function alertPill(a) {
    if (a.kind === 'bad') return pill('bad', 'Hinterher');
    if (a.kind === 'warn') return pill('warn', 'Wird knapp');
    if (a.kind === 'start') return pill('warn', 'Start bald');
    return pill('neutral', 'Themen fehlen');
  }
  function alertShort(a) {
    const name = modLabel(a.m) + ' · ' + (a.m.short || a.m.name);
    if (a.kind === 'bad' || a.kind === 'warn') return name + ': ' + paceTxt(a.s) + ' Themen pro Woche nötig';
    if (a.kind === 'start') return name + ': spätestens am ' + dateShort(a.s.latestStart) + ' starten';
    return name + ': Themen anlegen';
  }
  function alertCard(a) {
    const { m, s } = a;
    const head = `<div class="alert-h">${alertPill(a)}<span class="meta">${esc(modLabel(m))} · ${esc(m.short || m.name)}</span></div>`;
    if (a.kind === 'bad' || a.kind === 'warn') {
      return `<div class="alert ${a.kind}">${head}<p><b>Jetzt feste Lernblöcke einplanen.</b> ${s.open} offene Themen, noch ${weeksTxt(s.weeks)} bis zur Klausurphase. Nötig sind ab dieser Woche ${paceTxt(s)} Themen pro Woche, dein Tempo liegt bei ${num(s.tempo)}.</p><button class="btn primary small" data-action="suggestFor" data-id="${esc(m.id)}">Lernblöcke vorschlagen</button></div>`;
    }
    if (a.kind === 'start') {
      const weeksNeeded = Math.ceil(s.open / s.tempo);
      return `<div class="alert warn">${head}<p><b>Starte spätestens am ${esc(F(s.latestStart, { weekday: 'short', day: 'numeric', month: 'numeric' }))} mit ${esc(modLabel(m))}.</b> Für ${s.open} Themen brauchst du bei deinem Tempo etwa ${weeksNeeded} ${weeksNeeded === 1 ? 'Woche' : 'Wochen'} bis zur Klausurphase.</p><button class="btn primary small" data-action="suggestFor" data-id="${esc(m.id)}">Lernblöcke vorschlagen</button></div>`;
    }
    return `<div class="alert">${head}<p><b>Lege die Themen für ${esc(modLabel(m))} an.</b> Erst dann kann die App rückwärts rechnen, wann du anfangen solltest.</p><button class="btn primary small" data-action="openModule" data-id="${esc(m.id)}">Themen anlegen</button></div>`;
  }

  function missedRow(b) {
    const info = blockInfo(b);
    return `<div class="miss"><button class="tl-body" data-action="openBlock" data-id="${esc(b.id)}"><div class="tl-title"><span class="dot" style="background:var(--${info.color})"></span><span class="tx">${esc(info.title)}</span></div><div class="tl-sub">${esc(dayLabel(b.s))} · ${hm(b.s)}${info.m ? ' · ' + esc(modLabel(info.m)) : ''}</div></button><div class="miss-act"><button class="btn small" data-action="reschedule" data-id="${esc(b.id)}">Neu planen</button><button class="check" data-action="toggleDone" data-id="${esc(b.id)}" aria-label="Als erledigt markieren">${ICON.check}</button></div></div>`;
  }

  function ringHTML(m) {
    const s = stats(m);
    const r = 32, c = 2 * Math.PI * r;
    const pct = Math.round(s.progress * 100);
    const arc = s.progress > 0 ? `<circle cx="40" cy="40" r="${r}" style="fill:none;stroke:var(--${m.color})" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * s.progress).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)"/>` : '';
    return `<button class="ringcard" data-action="openModule" data-id="${esc(m.id)}"><svg viewBox="0 0 80 80" width="84" height="84" role="img" aria-label="Noch ${s.daysToExam} Tage bis zur Klausur, ${pct} Prozent Fortschritt"><circle cx="40" cy="40" r="${r}" style="fill:none;stroke:var(--line)" stroke-width="6"/>${arc}<text x="40" y="43" class="ring-n" text-anchor="middle">${s.daysToExam}</text><text x="40" y="56" class="ring-u" text-anchor="middle">${s.daysToExam === 1 ? 'Tag' : 'Tage'}</text></svg><span class="ring-m">${esc(modLabel(m))}</span><span class="ring-name">${esc(m.short || m.name)}</span><span class="ring-p">${pct} % Fortschritt</span></button>`;
  }

  function weekBars(ix, today) {
    let total = 0;
    const cols = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i), dEnd = addDays(d, 1);
      const bs = ix.blocks.filter((b) => b.s >= d && b.s < dEnd);
      const mins = bs.reduce((a, b) => a + (b.e - b.s) / 6e4, 0);
      total += mins;
      const segs = bs.map((b) => { const m = modById(b.moduleId); return `<span style="height:${Math.max(3, Math.round((b.e - b.s) / 6e4 / 360 * 72))}px;background:var(--${m ? m.color : 'ink-3'})${b.done ? ';opacity:.45' : ''}"></span>`; }).join('');
      return `<div class="bcol ${i === 0 ? 'today' : ''}"><div class="bstack">${segs ? segs + `<b class="bval">${num(mins / 60)}</b>` : '<i></i>'}</div><span class="blab">${WD[d.getDay()]}</span></div>`;
    }).join('');
    return { cols, total };
  }

  // ---------- Ansicht: Module ----------

  function viewModules() {
    const act = activeMods();
    const done = doneMods();
    return `<div class="view">
      <header class="sh"><div><div class="eyebrow">${act.length} offen · ${done.length} abgeschlossen</div><h1>Module</h1></div><button class="iconbtn" data-action="addModule" aria-label="Modul hinzufügen">${ICON.plus}</button></header>
      ${act.length ? `<div class="mcards">${act.map(mcard).join('')}</div>` : '<div class="alert"><p><b>Noch keine offenen Module.</b> Lege deine Module mit Klausurdatum an, zum Beispiel Modul 3, 4 und 5.</p><button class="btn primary small" data-action="addModule">Modul anlegen</button></div>'}
      ${done.length ? `<section class="sec"><div class="sec-h"><h2>Abgeschlossen</h2></div><div class="chips">${done.map((m) => `<button class="chip" data-action="openModule" data-id="${esc(m.id)}">${ICON.check} ${esc(modLabel(m))}</button>`).join('')}</div></section>` : ''}
      <button class="btn wide" data-action="addModule">${ICON.plus} Modul hinzufügen</button>
    </div>`;
  }

  function mcard(m) {
    const s = stats(m);
    const ex = s.ex;
    return `<button class="mcard" data-action="openModule" data-id="${esc(m.id)}"><div class="mc-top"><span class="eyebrow"><span class="dot" style="background:var(--${m.color})"></span>${esc(modLabel(m))}</span>${statusPill(s.status)}</div><div class="mc-name">${esc(m.name)}</div>${s.n ? sbar(m, s) : '<div class="sbar"></div>'}<div class="mc-meta"><span>${s.n ? `${s.n - s.open} von ${s.n} Themen gelernt` : 'Noch keine Themen'}</span><span>${ex ? 'Klausur ' + F(ex, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Kein Klausurdatum'}</span></div></button>`;
  }

  function viewDetail() {
    const m = modById(S.ui.detail);
    const s = stats(m);
    const ts = topicsOf(m.id);
    const tk = tasksOf(m.id);
    const openTasks = tk.filter((t) => !t.done).length;
    let notice = '';
    if (s.status === 'past') notice = `<div class="alert"><p><b>Die Klausur ist vorbei.</b> Möchtest du das Modul als abgeschlossen markieren?</p><button class="btn primary small" data-action="moduleDone" data-id="${esc(m.id)}">Als abgeschlossen markieren</button></div>`;
    else if (!m.done && s.inPhase) notice = `<div class="alert"><div class="alert-h"><span class="pill warn">Klausurphase</span></div><p>Jetzt zählt Wiederholen: Themen auf „sitzt“ bringen und Übungsklausuren schreiben.</p></div>`;
    const eyebrow = esc(modLabel(m)) + (s.ex ? ' · Klausur ' + esc(F(s.ex, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })) : '') + (m.done ? ' · abgeschlossen' : '');
    return `<div class="view">
      <div class="sec"><button class="back" data-action="back">${ICON.chevL}Module</button>
      <header class="sh"><div><div class="eyebrow"><span class="dot" style="background:var(--${m.color})"></span>${eyebrow}</div><h1>${esc(m.name)}</h1></div><button class="iconbtn" data-action="editModule" data-id="${esc(m.id)}" aria-label="Modul bearbeiten">${ICON.edit}</button></header></div>
      ${notice}
      <div class="stats"><div><b>${s.n}</b><span>Themen</span></div><div><b>${s.daysToExam === null ? '–' : Math.max(0, s.daysToExam)}</b><span>Tage bis zur Klausur</span></div><div><b>${paceTxt(s)}</b><span>Themen pro Woche nötig</span></div></div>
      ${s.n ? `<div class="sec">${sbar(m, s)}${statusLegend(m, s)}</div>` : ''}
      <div class="seg" role="group" aria-label="Ansicht"><button data-action="dtab" data-v="themen" aria-pressed="${S.ui.dtab === 'themen'}">Themen (${s.n})</button><button data-action="dtab" data-v="aufgaben" aria-pressed="${S.ui.dtab === 'aufgaben'}">Aufgaben${openTasks ? ' (' + openTasks + ')' : ''}</button></div>
      <div class="sec">${S.ui.dtab === 'themen' ? topicsHTML(m, ts) : tasksHTML(tk)}</div>
    </div>`;
  }

  function topicsHTML(m, ts) {
    const rows = ts.map((t) => {
      const st = clampStatus(t.status);
      return `<div class="topic"><button class="ringbtn" data-action="cycle" data-id="${esc(t.id)}" aria-label="${esc(t.title)}: ${STATUS[st]}. Antippen, um den Status zu ändern">${statusRing(st, m.color)}</button><button class="tp-body" data-action="openTopic" data-id="${esc(t.id)}"><span class="tp-t">${esc(t.title)}</span>${t.ref ? `<span class="tp-ref">${esc(t.ref)}</span>` : ''}</button><span class="tp-s s${st}">${STATUS[st]}</span></div>`;
    }).join('');
    return `${ts.length ? `<div class="card"><div class="topics">${rows}</div></div>` : '<p class="empty">Noch keine Themen. Übernimm zum Beispiel die Gliederung aus dem Inhaltsverzeichnis deines Skripts. Mit „Mehrere Themen einfügen“ geht das in einem Rutsch.</p>'}
      <form class="addrow" data-form="topicAdd"><input type="text" id="f-topic" data-draft placeholder="Neues Thema, z. B. Organschaft § 14 KStG" autocomplete="off" aria-label="Neues Thema" value="${esc(S.ui.drafts['f-topic'] || '')}"><button class="btn small primary" type="submit">Hinzufügen</button></form>
      <button class="linkbtn" data-action="bulkTopics">Mehrere Themen einfügen</button>
      <p class="note">Tippe auf den Kreis, um den Status weiterzuschalten: offen → gelernt → wiederholt → sitzt. Tippe auf ein Thema, um es zu bearbeiten.</p>`;
  }

  function tasksHTML(tk) {
    return `${tk.length ? `<div class="card"><div class="tasks">${tk.map((t) => taskRow(t, false)).join('')}</div></div>` : '<p class="empty">Noch keine Aufgaben für dieses Modul.</p>'}
      <form class="addrow two" data-form="taskAdd"><input type="text" id="f-task" data-draft placeholder="Neue Aufgabe, z. B. Übungsklausur 2" autocomplete="off" aria-label="Neue Aufgabe" value="${esc(S.ui.drafts['f-task'] || '')}"><input type="date" id="f-due" data-draft aria-label="Fällig am" value="${esc(S.ui.drafts['f-due'] || ymd(addDays(new Date(), 7)))}"><button class="btn small primary" type="submit">Hinzufügen</button></form>`;
  }

  // ---------- Ansicht: Plan ----------

  function viewPlan() {
    const now = new Date();
    const ix = calIndex();
    const page = clamp(S.ui.page, 0, 2);
    const days = pageDays();
    const dms = days.map((d) => dayModel(d, ix, now));
    const sel = clamp(S.ui.day, 0, 6);
    const dm = dms[sel];
    let h0 = 6, h1 = 22;
    dms.forEach((x) => x.items.forEach((it) => { h0 = Math.min(h0, Math.floor(it.a / 60)); h1 = Math.max(h1, Math.ceil(it.b / 60)); }));
    const span = (h1 - h0) * 60;
    const pct = (m) => ((m - h0 * 60) / span * 100).toFixed(2);
    const pos = (a, b) => `top:${pct(a)}%;height:${(Math.max(b - a, 12) / span * 100).toFixed(2)}%`;
    const head = days.map((d, i) => `<button class="wk-d ${i === sel ? 'sel' : ''}" data-action="selectDay" data-i="${i}" aria-pressed="${i === sel}" aria-label="${esc(dateLong(d))}${dms[i].vacation ? ', frei' : ''}"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b><i class="${dms[i].vacation ? 'vac-dot' : ''}"></i></button>`).join('');
    const cols = dms.map((x, i) => `<div class="wk-col ${x.vacation ? 'vac' : ''} ${i === sel && !x.vacation ? 'sel' : ''}">${x.items.map((it) => gridItem(it, x.key, pos)).join('')}</div>`).join('');
    const ticks = [];
    for (let h = Math.ceil(h0 / 6) * 6; h < h1; h += 6) ticks.push(h);
    const free = dm.items.filter((x) => x.type === 'free').reduce((a, x) => a + x.b - x.a, 0);
    const note = dm.vacation
      ? `Erkannt an „${esc(trunc(dm.vacTitle || 'Urlaub', 40))}“ in deinem Google Kalender. An freien Tagen plant die App wie am Wochenende.`
      : free ? `${durTxt(free)} frei. Tippe auf ein freies Zeitfenster, um einen Lernblock einzutragen.` : 'Kein Lernfenster mehr frei. Deine Lernzeiten änderst du in den Einstellungen.';
    const dayPill = dm.vacation ? pill('ok', 'Urlaub') : dm.work ? pill('neutral', 'Arbeitstag') : pill('neutral', 'Frei');
    const n = S.ui.sugg.length;
    return `<div class="view">
      <header class="sh"><div><div class="eyebrow">${page === 0 ? 'Nächste 7 Tage' : 'In ' + page + (page === 1 ? ' Woche' : ' Wochen')}</div><h1>Plan</h1></div><button class="btn small" data-action="suggest">Plan vorschlagen</button></header>
      ${n ? `<div class="suggest"><div><b>${n} ${n === 1 ? 'Vorschlag' : 'Vorschläge'}</b><span>Freie Zeitfenster sind mit offenen Themen und Wiederholungen gefüllt. In den Google Kalender kommen sie erst mit „Übernehmen“.</span></div><div class="row"><button class="btn small" data-action="discard">Verwerfen</button><button class="btn small primary" data-action="accept">Übernehmen</button></div></div>` : ''}
      <div class="wk">
        <div class="pagenav"><button class="iconbtn ghost" data-action="page" data-dir="-1" ${page === 0 ? 'disabled' : ''} aria-label="Vorherige Woche">${ICON.chevL}</button><b>${esc(F(days[0], { day: 'numeric', month: 'short' }))} – ${esc(F(days[6], { day: 'numeric', month: 'short' }))}</b><button class="iconbtn ghost" data-action="page" data-dir="1" ${page === 2 ? 'disabled' : ''} aria-label="Nächste Woche">${ICON.chevR}</button></div>
        <div class="wk-head"><span></span>${head}</div>
        <div class="wk-body"><div class="wk-axis">${ticks.map((h) => `<span style="top:${pct(h * 60)}%">${h}</span>`).join('')}</div>${cols}<div class="wk-lines">${ticks.filter((h) => h > h0).map((h) => `<i style="top:${pct(h * 60)}%"></i>`).join('')}</div></div>
        <div class="legend"><span><i class="lg work"></i>Arbeit</span><span><i class="lg learn"></i>Lernblock</span><span><i class="lg sugg"></i>Vorschlag</span><span><i class="lg free"></i>Frei</span><span><i class="lg event"></i>Termin</span><span><i class="lg sport"></i>Sport</span><span><i class="lg vac"></i>Urlaub</span></div>
      </div>
      <section class="sec"><div class="sec-h"><h2>${esc(dateLong(dm.day))}</h2>${dayPill}</div>
        ${dm.items.length ? `<div class="card"><div class="tls">${dm.items.map((it) => rowHTML(it, dm.key)).join('')}</div></div>` : '<p class="empty">An diesem Tag ist nichts eingetragen und kein Lernfenster frei.</p>'}
        <p class="note">${note}</p>
      </section>
    </div>`;
  }

  function gridItem(it, key, pos) {
    const p = pos(it.a, it.b);
    if (it.type === 'fixed') return `<span class="wb ${it.kind}" style="${p}" title="${esc(it.title)}"></span>`;
    if (it.type === 'free') return `<button class="wb free" style="${p}" data-action="planSlot" data-day="${key}" data-a="${it.a}" data-b="${it.b}" aria-label="Freies Zeitfenster ab ${fmtMin(it.a)} planen"></button>`;
    const info = blockInfo(it.blk);
    if (it.type === 'sugg') return `<button class="wb sugg" style="${p};--c:var(--${info.color})" data-action="openSugg" data-id="${esc(it.blk.id)}" aria-label="Vorschlag: ${esc(info.title)}"></button>`;
    return `<button class="wb block ${it.blk.done ? 'done' : ''}" style="${p};--c:var(--${info.color})" data-action="openBlock" data-id="${esc(it.blk.id)}" aria-label="Lernblock: ${esc(info.title)}"></button>`;
  }

  // ---------- Ansicht: Zeitplan ----------

  function viewZeit() {
    const today = sod(new Date());
    const mods = activeMods().filter((m) => { const ex = examOf(m); return ex && diffDays(ex, today) >= 0; });
    const tempo = num(cfg().tempo);
    return `<div class="view">
      <header class="sh"><div><div class="eyebrow">Bis zur letzten Klausur</div><h1>Zeitplan</h1></div></header>
      ${mods.length ? `<div class="card gantt">${gantt(mods)}<div class="legend"><span><i class="lg" style="background:color-mix(in srgb, var(--ink-2) 22%, transparent)"></i>Lernphase</span><span><i class="lg" style="background:color-mix(in srgb, var(--ink-2) 62%, transparent)"></i>Klausurphase, ${cfg().klausurphaseWochen} Wochen</span><span><i class="lg" style="background:var(--ink-2);border-radius:50%;width:10px"></i>Klausur</span></div></div>
      <section class="sec"><div class="sec-h"><h2>Rückwärtsrechner</h2></div><p class="note">So viele Themen musst du pro Woche schaffen, um vor der Klausurphase einmal mit allem durch zu sein. Dein Tempo von ${tempo} Themen pro Woche stellst du in den Einstellungen ein.</p><div class="card"><div class="calc">${mods.map(calcRow).join('')}</div></div></section>`
      : '<p class="empty">Sobald deine offenen Module ein Klausurdatum haben, siehst du hier Lern- und Klausurphasen auf einem Zeitstrahl.</p>'}
      <div class="stb"><span class="eyebrow">Später</span><b>Steuerberaterprüfung</b><span>Die langfristige Vorbereitung kommt hier dazu, sobald die Eckdaten für 2027 feststehen.</span></div>
    </div>`;
  }

  function gantt(ms) {
    const today = sod(new Date());
    const phaseDays = Math.max(0, Number(cfg().klausurphaseWochen) || 0) * 7;
    const W = 320, top = 30, rowH = 50;
    const last = ms.reduce((a, m) => (examOf(m) > a ? examOf(m) : a), addDays(today, 30));
    const end = addDays(last, 12);
    const span = Math.max(30, diffDays(end, today));
    const x = (d) => (Math.max(0, Math.min(span, diffDays(d, today))) / span) * W;
    const H = top + ms.length * rowH;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Zeitstrahl mit Lernphasen, Klausurphasen und Klausurterminen">`;
    let mm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    while (mm < end) {
      const xx = x(mm);
      s += `<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="18" y2="${H}" style="stroke:var(--line)" stroke-width="1"/>`;
      if (xx > 36 && xx < W - 22) s += `<text x="${(xx + 3).toFixed(1)}" y="12" class="g-tick">${esc(F(mm, { month: 'short' }).replace('.', ''))}</text>`;
      mm = new Date(mm.getFullYear(), mm.getMonth() + 1, 1);
    }
    s += `<line x1="1" x2="1" y1="16" y2="${H}" style="stroke:var(--ink)" stroke-width="2"/><text x="0" y="12" class="g-tick g-today">Heute</text>`;
    ms.forEach((m, i) => {
      const ex = examOf(m);
      const y = top + i * rowH;
      const x1 = x(addDays(ex, -phaseDays));
      const x2 = x(ex);
      s += `<text x="7" y="${y + 8}" class="g-label">${esc(trunc(modLabel(m) + ' · ' + (m.short || m.name), 32))}</text><text x="${W}" y="${y + 8}" class="g-date" text-anchor="end">${esc(F(ex, { day: 'numeric', month: 'numeric', year: '2-digit' }))}</text>`;
      if (x1 > 6) s += `<rect x="4" y="${y + 16}" width="${(x1 - 4).toFixed(1)}" height="12" rx="3" style="fill:var(--${m.color});fill-opacity:.22"/>`;
      const px = Math.max(4, x1);
      s += `<rect x="${px.toFixed(1)}" y="${y + 16}" width="${Math.max(2, x2 - px).toFixed(1)}" height="12" rx="3" style="fill:var(--${m.color});fill-opacity:.62"/>`;
      s += `<circle cx="${Math.min(W - 7, Math.max(7, x2)).toFixed(1)}" cy="${y + 22}" r="6.5" style="fill:var(--${m.color});stroke:var(--surface)" stroke-width="2.5"/>`;
    });
    return s + '</svg>';
  }

  function calcRow(m) {
    const s = stats(m);
    const head = `<div class="crow-h"><span><span class="dot" style="background:var(--${m.color})"></span>${esc(modLabel(m))} · ${esc(trunc(m.short || m.name, 26))}</span>${statusPill(s.status)}</div>`;
    if (!s.n) return `<div class="crow">${head}<p class="note">Lege Themen an, damit die App rechnen kann.</p></div>`;
    const max = s.tempo * 2;
    const p = isFinite(s.pace) ? Math.min(s.pace, max) : max;
    return `<div class="crow">${head}
      <div class="crow-n"><div><b>${s.open}</b><span>offene Themen</span></div><div><b>${Math.floor(s.weeks)}</b><span>Lernwochen</span></div><div><b>${paceTxt(s)}</b><span>Themen pro Woche</span></div></div>
      <div class="gauge" role="img" aria-label="Nötiges Tempo ${paceTxt(s)} Themen pro Woche, dein Tempo ${num(s.tempo)}"><span class="z ok" style="width:50%"></span><span class="z warn" style="width:25%"></span><span class="z bad" style="width:25%"></span><i style="left:${(p / max * 100).toFixed(1)}%"></i></div>
      <div class="gauge-ax"><span>0</span><span>dein Tempo: ${num(s.tempo)}</span><span>${num(max)}+</span></div>
    </div>`;
  }

  // ---------- Ansicht: Einstellungen ----------

  function connSection() {
    const st = S.sync.state;
    const statePill = st === 'syncing' ? pill('warn', 'gleicht ab') : st === 'offline' ? pill('neutral', 'offline') : (st === 'error' || st === 'auth') ? pill('bad', 'Problem') : pill('ok', 'verbunden');
    const pending = S.outbox.length;
    return `<div class="sec-h"><h2>Verbindung</h2>${statePill}</div>
        <div class="card pad">
          <p class="lead">Zuletzt abgeglichen: ${esc(ago(S.meta.lastOk))}.${pending ? ' ' + pending + (pending > 1 ? ' Änderungen warten' : ' Änderung wartet') + ' auf die Übertragung.' : ''}</p>
          ${S.sync.msg ? `<p class="err">${esc(S.sync.msg)}</p>` : ''}
          <div class="row"><button class="btn" data-action="syncNow">Jetzt abgleichen</button>${S.meta.sheetUrl ? `<a class="btn" href="${esc(S.meta.sheetUrl)}" target="_blank" rel="noopener">Tabelle öffnen</a>` : ''}</div>
          <button class="btn wide" data-action="connectDevice">Weiteres Gerät verbinden</button>
        </div>`;
  }

  function viewSettings() {
    const c = cfg();
    const pending = S.outbox.length;
    return `<div class="view">
      <div class="sec"><button class="back" data-action="back">${ICON.chevL}Zurück</button>
      <header class="sh"><div><div class="eyebrow">Studienplaner ${APP_VERSION}</div><h1>Einstellungen</h1></div></header></div>
      ${backendNotice()}
      <section class="sec" id="conn">${connSection()}</section>
      <form class="view" data-form="settings" novalidate>
        <section class="sec"><div class="sec-h"><h2>Kalender</h2></div><div class="card pad">${formCalendars(c)}</div></section>
        <section class="sec"><div class="sec-h"><h2>Zeiten</h2></div><div class="card pad">${formTimes(c)}</div></section>
        <section class="sec"><div class="sec-h"><h2>Planung</h2></div><div class="card pad">${formPlanning(c)}</div></section>
        <p class="err" id="f-serr" hidden></p>
        <button class="btn primary wide" type="submit">Einstellungen speichern</button>
      </form>
      <section class="sec"><div class="sec-h"><h2>Dieses Gerät</h2></div>
        ${S.ui.confirm === 'disconnect'
          ? `<div class="confirm"><p>Die App vergisst die Verbindung und die Daten auf diesem Gerät. In Google bleibt alles erhalten.${pending ? ' <b>Achtung: ' + pending + ' Änderungen sind noch nicht übertragen.</b>' : ''} Auf diesem Gerät kannst du dich danach mit derselben Web-App-URL wieder verbinden.</p><div class="row"><button class="btn" data-action="confirm" data-what="">Abbrechen</button><button class="btn danger primary" data-action="disconnect">Trennen</button></div></div>`
          : '<button class="btn danger wide" data-action="confirm" data-what="disconnect">Verbindung auf diesem Gerät trennen</button>'}
      </section>
    </div>`;
  }

  function formCalendars(c) {
    const cals = (S.cal && S.cal.calendars ? S.cal.calendars : []).filter((x) => !x.lernplan);
    const busy = Array.isArray(c.busyCalendarIds) ? c.busyCalendarIds : cals.filter((x) => x.primary).map((x) => x.id);
    return `<div class="frow"><label for="f-il">ILIAS-Kalender</label><select id="f-il"><option value="">Keiner</option>${cals.map((x) => `<option value="${esc(x.id)}" ${x.id === c.iliasCalendarId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <fieldset class="frow"><legend>Diese Kalender blockieren Lernzeit</legend><div class="checks">${cals.length ? cals.map((x, i) => `<label class="check-row"><input type="checkbox" id="f-bc-${i}" data-cal="${esc(x.id)}" ${busy.includes(x.id) || x.id === c.iliasCalendarId ? 'checked' : ''}><span>${esc(x.name)}${x.primary ? '<em>Hauptkalender</em>' : ''}</span></label>`).join('') : '<p class="note">Noch keine Kalender geladen.</p>'}</div></fieldset>
      <div class="frow"><label for="f-uk">Freie Tage erkennen an</label><input type="text" id="f-uk" value="${esc((c.urlaubStichwoerter || []).join(', '))}" autocomplete="off"><span class="note">Stichwörter im Termintitel, durch Komma getrennt. Ein Termin wie „Urlaub“ macht den Tag zum freien Tag.</span></div>`;
  }

  function formTimes(c) {
    const days = [1, 2, 3, 4, 5, 6, 0];
    const lw = (c.lernenWerktags && c.lernenWerktags[0]) || { von: '', bis: '' };
    const lf = c.lernenFrei || [];
    const lf1 = lf[0] || { von: '', bis: '' };
    const lf2 = lf[1] || { von: '', bis: '' };
    const sp = Object.assign({}, DEFAULTS.sport, c.sport || {});
    const t = (id, v) => `<input type="time" id="${id}" value="${esc(v || '')}">`;
    return `<div class="frow"><span class="flabel">Arbeitstage</span><div class="daychips">${days.map((d) => `<input type="checkbox" id="f-ad-${d}" ${c.arbeit.tage.includes(d) ? 'checked' : ''}><label for="f-ad-${d}">${WD[d]}</label>`).join('')}</div></div>
      <div class="frow"><span class="flabel">Arbeitszeit</span><div class="pair"><label>von${t('f-av', c.arbeit.von)}</label><label>bis${t('f-ab', c.arbeit.bis)}</label></div></div>
      <div class="frow"><span class="flabel">Lernzeit an Arbeitstagen</span><div class="pair"><label>von${t('f-lwv', lw.von)}</label><label>bis${t('f-lwb', lw.bis)}</label></div></div>
      <div class="frow"><span class="flabel">Lernzeit an freien Tagen</span><div class="pair"><label>von${t('f-lf1v', lf1.von)}</label><label>bis${t('f-lf1b', lf1.bis)}</label></div><div class="pair"><label>und von${t('f-lf2v', lf2.von)}</label><label>bis${t('f-lf2b', lf2.bis)}</label></div><span class="note">Freie Tage sind Wochenenden und Tage mit „Urlaub“ im Kalender. Das zweite Fenster kannst du leer lassen.</span></div>
      <div class="frow"><label class="check-row"><input type="checkbox" id="f-sa" ${sp.aktiv ? 'checked' : ''}><span>Zeit für Sport freihalten</span></label><div class="pair"><label>Tag<select id="f-st">${days.map((d) => `<option value="${d}" ${Number(sp.tag) === d ? 'selected' : ''}>${WD_LONG[d]}</option>`).join('')}</select></label><span></span></div><div class="pair"><label>von${t('f-sv', sp.von)}</label><label>bis${t('f-sb', sp.bis)}</label></div></div>`;
  }

  function formPlanning(c) {
    return `<div class="pair"><label>Klausurphase in Wochen<input type="number" id="f-kp" min="0" max="12" step="1" inputmode="numeric" value="${esc(c.klausurphaseWochen)}"></label><label>Dein Tempo (Themen pro Woche)<input type="number" id="f-tp" min="0.5" max="20" step="0.5" inputmode="decimal" value="${esc(c.tempo)}"></label></div>
      <div class="frow"><label for="f-bl">Länge eines Lernblocks</label><select id="f-bl">${[45, 60, 90, 120].map((m) => `<option value="${m}" ${Number(c.blockMinuten) === m ? 'selected' : ''}>${m} Minuten</option>`).join('')}</select></div>
      <p class="note">Das Tempo gilt pro Modul. Muss es höher sein, zeigt die App „knapp“ (bis zum 1,5-Fachen) oder „hinterher“. In der Klausurphase plant die App vor allem Wiederholungen.</p>`;
  }

  function readSettingsForm(base) {
    const val = (id) => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    const has = (id) => !!document.getElementById(id);
    const chk = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
    const s = JSON.parse(JSON.stringify(base));
    const errs = [];
    const span = (a, b, label, optional) => {
      if (optional && !a && !b) return null;
      const x = toMin(a), y = toMin(b);
      if (x === null || y === null || y <= x) { errs.push(label); return null; }
      return { von: a, bis: b };
    };
    if (has('f-av')) {
      s.arbeit = { tage: [0, 1, 2, 3, 4, 5, 6].filter((d) => chk('f-ad-' + d)), von: val('f-av'), bis: val('f-ab') };
      if (s.arbeit.tage.length) span(s.arbeit.von, s.arbeit.bis, 'Arbeitszeit');
      const lw = span(val('f-lwv'), val('f-lwb'), 'Lernzeit an Arbeitstagen', true);
      s.lernenWerktags = lw ? [lw] : [];
      const f1 = span(val('f-lf1v'), val('f-lf1b'), 'Lernzeit an freien Tagen', true);
      const f2 = span(val('f-lf2v'), val('f-lf2b'), 'zweites Lernfenster an freien Tagen', true);
      s.lernenFrei = [f1, f2].filter(Boolean);
      s.sport = { aktiv: chk('f-sa'), tag: Number(val('f-st')), von: val('f-sv'), bis: val('f-sb') };
      if (s.sport.aktiv) span(s.sport.von, s.sport.bis, 'Sportzeit');
    }
    if (has('f-il')) {
      s.iliasCalendarId = val('f-il');
      s.busyCalendarIds = $$('input[data-cal]').filter((x) => x.checked).map((x) => x.dataset.cal);
      s.urlaubStichwoerter = val('f-uk').split(',').map((x) => x.trim()).filter(Boolean);
    }
    if (has('f-kp')) {
      s.klausurphaseWochen = clamp(parseInt(val('f-kp'), 10) || 0, 0, 12);
      const tp = parseFloat(val('f-tp').replace(',', '.'));
      s.tempo = clamp(isNaN(tp) ? DEFAULTS.tempo : tp, 0.25, 20);
      s.blockMinuten = clamp(parseInt(val('f-bl'), 10) || 90, 30, 240);
    }
    return { s, errs };
  }

  function showFormErrors(errs) {
    const el = document.getElementById('f-serr');
    if (!el) return;
    el.textContent = 'Bitte prüfe: ' + errs.join(', ') + '. Die Endzeit muss nach der Startzeit liegen.';
    el.hidden = false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ---------- Sheets ----------

  const screen = document.getElementById('screen');
  const sheet = document.getElementById('sheet');
  const scrim = document.getElementById('scrim');
  const toastEl = document.getElementById('toast');
  // Zurück-Taste (Android): Solange ein Sheet, ein Modul oder die Einstellungen offen sind,
  // liegt genau ein Eintrag im Verlauf. „Zurück“ schließt dann die oberste Ebene.
  const nav = {
    guard: false,
    popping: false,
    update() {
      if (this.popping) return;
      const need = !sheet.hidden || (S.ui.tab === 'module' && !!S.ui.detail) || S.ui.tab === 'einst';
      if (need && !this.guard) { history.pushState({ sp: 1 }, ''); this.guard = true; }
      else if (!need && this.guard) { this.popping = true; history.back(); }
    },
    onPop() {
      if (this.popping) { this.popping = false; this.guard = false; this.update(); return; }
      this.guard = false;
      closeTopView();
      this.update();
    }
  };

  function openSheet(html) {
    const wasHidden = sheet.hidden;
    sheet.innerHTML = '<div class="grab"></div>' + html;
    sheet.hidden = false;
    scrim.hidden = false;
    if (wasHidden) {
      sheet.classList.remove('opening');
      void sheet.offsetWidth;
      sheet.classList.add('opening');
      sheet.scrollTop = 0;
    }
    nav.update();
  }
  function hideSheet() {
    sheet.hidden = true;
    scrim.hidden = true;
    sheet.innerHTML = '';
  }
  function closeSheet() {
    if (sheet.hidden) return;
    hideSheet();
    nav.update();
  }
  function closeTopView() {
    if (!sheet.hidden) { hideSheet(); return; }
    if (S.ui.tab === 'module' && S.ui.detail) { S.ui.detail = null; render(); screen.scrollTop = 0; return; }
    if (S.ui.tab === 'einst') { S.ui.tab = 'heute'; render(); screen.scrollTop = 0; }
  }
  function navBack() {
    closeTopView();
    nav.update();
  }

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  const DEL_TEXT = {
    module: 'Das Modul wird mit allen Themen und Aufgaben gelöscht, auch in der Google-Tabelle. Bereits geplante Lernblöcke bleiben im Kalender.',
    topic: 'Das Thema wird gelöscht, auch in der Google-Tabelle.',
    task: 'Die Aufgabe wird gelöscht, auch in der Google-Tabelle.'
  };
  const delButton = (kind, id, label) => `<button class="btn danger wide" data-action="askDelete" data-kind="${kind}" data-id="${esc(id)}" data-label="${esc(label)}">${esc(label)}</button>`;
  const delConfirm = (kind, id, label) => `<div class="confirm"><p>${DEL_TEXT[kind]}</p><div class="row"><button class="btn" data-action="cancelDelete" data-kind="${kind}" data-id="${esc(id)}" data-label="${esc(label)}">Abbrechen</button><button class="btn danger primary" data-action="del" data-kind="${kind}" data-id="${esc(id)}">Endgültig löschen</button></div></div>`;

  function moduleSheet(id) {
    const m = id ? modById(id) : null;
    const used = new Set(S.data.modules.map((x) => x.color));
    const color = m ? m.color : (COLORS.find((c) => !used.has(c)) || 'm1');
    const nextNr = m ? (m.nr === null || m.nr === undefined ? '' : m.nr) : S.data.modules.reduce((a, x) => Math.max(a, Number(x.nr) || 0), 0) + 1;
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">${m ? 'Bearbeiten' : 'Neu'}</div><h3>${m ? esc(m.name) : 'Modul hinzufügen'}</h3></div>${closeBtn()}</div>
      <form class="form" data-form="module" data-id="${m ? esc(m.id) : ''}" novalidate>
        <div class="pair"><label>Nummer<input type="number" id="f-mnr" inputmode="numeric" min="0" value="${esc(nextNr)}"></label><label>Klausurdatum<input type="date" id="f-mex" value="${esc(m ? m.exam : '')}"></label></div>
        <div class="frow"><label for="f-mname">Name</label><input type="text" id="f-mname" placeholder="z. B. Umsatzsteuer" autocomplete="off" value="${esc(m ? m.name : '')}"></div>
        <div class="frow"><label for="f-mshort">Kurzname (optional, für Übersichten)</label><input type="text" id="f-mshort" autocomplete="off" value="${esc(m && m.short && m.short !== m.name ? m.short : '')}"></div>
        <fieldset class="frow"><legend>Farbe</legend><div class="swatches">${COLORS.map((c, i) => `<input type="radio" name="f-mcol" id="f-mc-${c}" value="${c}" ${c === color ? 'checked' : ''}><label for="f-mc-${c}" style="--c:var(--${c})" aria-label="Farbe ${i + 1}"></label>`).join('')}</div></fieldset>
        <label class="check-row"><input type="checkbox" id="f-mdone" ${m && m.done ? 'checked' : ''}><span>Abgeschlossen</span></label>
        <p class="err" id="f-merr" hidden></p>
        <button class="btn primary wide" type="submit">${m ? 'Speichern' : 'Modul anlegen'}</button>
        ${m ? '' : '<p class="note">Die Klausur trägt die App automatisch in deinen Google Kalender „Lernplan“ ein.</p>'}
      </form>
      ${m ? `<div id="delzone">${delButton('module', m.id, 'Modul löschen')}</div>` : ''}`);
  }

  function topicSheet(id) {
    const t = topicById(id);
    if (!t) return;
    const m = modById(t.moduleId);
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">${m ? esc(modLabel(m)) : 'Thema'}</div><h3>Thema bearbeiten</h3></div>${closeBtn()}</div>
      <form class="form" data-form="topic" data-id="${esc(t.id)}" novalidate>
        <div class="frow"><label for="f-tt">Thema</label><input type="text" id="f-tt" value="${esc(t.title)}" autocomplete="off"></div>
        <div class="frow"><label for="f-tr">Fundstelle (optional)</label><input type="text" id="f-tr" value="${esc(t.ref || '')}" placeholder="z. B. § 15 UStG" autocomplete="off"></div>
        <fieldset class="frow"><legend>Status</legend><div class="segin">${STATUS.map((s, i) => `<input type="radio" name="f-ts" id="f-ts-${i}" value="${i}" ${clampStatus(t.status) === i ? 'checked' : ''}><label for="f-ts-${i}">${s}</label>`).join('')}</div></fieldset>
        <p class="err" id="f-terr" hidden></p>
        <button class="btn primary wide" type="submit">Speichern</button>
      </form>
      <div id="delzone">${delButton('topic', t.id, 'Thema löschen')}</div>`);
  }

  function bulkSheet() {
    const m = modById(S.ui.detail);
    if (!m) return;
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">${esc(modLabel(m))}</div><h3>Mehrere Themen einfügen</h3></div>${closeBtn()}</div>
      <form class="form" data-form="bulk" novalidate>
        <p class="lead">Eine Zeile pro Thema. Gliederungsnummern, Punktlinien und Seitenzahlen entfernt die App. Eine Fundstelle mit § speichert sie getrennt.</p>
        <textarea id="f-bulk" aria-label="Themen, eine pro Zeile" placeholder="Steuerbarkeit § 1 UStG&#10;Unternehmer § 2 UStG&#10;3.1 Ort der Lieferung ........ 45"></textarea>
        <p class="note" id="f-bcount">Noch keine Themen erkannt.</p>
        <button class="btn primary wide" type="submit">Themen hinzufügen</button>
      </form>`);
  }

  function taskSheet(id) {
    const t = taskById(id);
    if (!t) return;
    const m = modById(t.moduleId);
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">${m ? esc(modLabel(m)) : 'Aufgabe'}</div><h3>Aufgabe bearbeiten</h3></div>${closeBtn()}</div>
      <form class="form" data-form="task" data-id="${esc(t.id)}" novalidate>
        <div class="frow"><label for="f-kt">Aufgabe</label><input type="text" id="f-kt" value="${esc(t.title)}" autocomplete="off"></div>
        <div class="frow"><label for="f-kd">Fällig am</label><input type="date" id="f-kd" value="${esc(t.due || '')}"></div>
        <label class="check-row"><input type="checkbox" id="f-kdone" ${t.done ? 'checked' : ''}><span>Erledigt</span></label>
        <p class="err" id="f-kerr" hidden></p>
        <button class="btn primary wide" type="submit">Speichern</button>
      </form>
      <div id="delzone">${delButton('task', t.id, 'Aufgabe löschen')}</div>`);
  }

  let ps = null;
  function planSheet() {
    const c = cfg();
    const day = parseYmd(ps.day);
    const len = ps.b - ps.a;
    const durs = [45, 60, 90, 120].filter((d) => d < len);
    durs.push(len);
    if (!ps.dur || ps.dur > len) ps.dur = len <= (Number(c.blockMinuten) || 90) + 30 ? len : Math.min(len, Number(c.blockMinuten) || 90);
    if (!durs.includes(ps.dur)) ps.dur = len;
    const mods = activeMods().filter((m) => topicsOf(m.id).some((t) => clampStatus(t.status) < 3));
    if (!ps.mod || !mods.some((m) => m.id === ps.mod)) {
      const sev = { bad: 3, warn: 2, ok: 1 };
      const best = mods.map((m) => ({ m, s: stats(m) })).sort((x, y) => ((sev[y.s.status] || 0) - (sev[x.s.status] || 0)) || byExam(x.m, y.m))[0];
      ps.mod = best ? best.m.id : null;
    }
    const m = modById(ps.mod);
    const topics = m ? topicsOf(m.id).filter((t) => clampStatus(t.status) < 3).sort((a, b) => clampStatus(a.status) - clampStatus(b.status)) : [];
    const body = mods.length
      ? `<div class="frow"><span class="flabel">Zeit</span><div class="chips">${durs.map((d) => `<button class="chip" data-action="psDur" data-v="${d}" aria-pressed="${ps.dur === d}">${fmtMin(ps.a)}–${fmtMin(ps.a + d)}</button>`).join('')}</div></div>
        <div class="frow"><span class="flabel">Modul</span><div class="chips">${mods.map((x) => `<button class="chip" data-action="psMod" data-id="${esc(x.id)}" aria-pressed="${x.id === ps.mod}"><span class="dot" style="background:var(--${x.color})"></span>${esc(modLabel(x))}</button>`).join('')}</div></div>
        <div class="frow"><span class="flabel">Thema</span><div class="picks">${topics.map((t) => { const st = clampStatus(t.status); return `<button class="pick" data-action="psTopic" data-id="${esc(t.id)}" aria-pressed="${ps.topic === t.id}">${statusRing(st, m.color, 22)}<span class="tp-body"><span class="tp-t">${esc(t.title)}</span><span class="tp-ref">${st === 0 ? 'Neu lernen' : 'Wiederholen'}${t.ref ? ' · ' + esc(t.ref) : ''}</span></span></button>`; }).join('')}</div></div>
        <button class="btn primary wide" data-action="psSave" ${ps.topic ? '' : 'disabled'}>In Google Kalender eintragen</button>`
      : '<p class="empty">Lege zuerst ein Modul mit Themen an. Dann kannst du hier Lernblöcke eintragen.</p><button class="btn primary wide" data-action="addModule">Modul anlegen</button>';
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">${esc(dateLong(day))}</div><h3>Lernblock planen</h3></div>${closeBtn()}</div>${body}`);
  }

  function blockSheet(id) {
    const b = findBlock(id);
    if (!b) return;
    const s = new Date(b.start), e = new Date(b.end);
    const info = blockInfo(b);
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">${info.m ? `<span class="dot" style="background:var(--${info.color})"></span>${esc(modLabel(info.m))} · ${esc(info.m.short || info.m.name)}` : 'Lernblock'}</div><h3>${esc(info.title)}</h3></div>${closeBtn()}</div>
      <dl class="facts"><div><dt>Wann</dt><dd>${esc(dateLong(s))}, ${hm(s)}–${hm(e)}</dd></div><div><dt>Art</dt><dd>${info.kind}</dd></div>${info.t ? `<div><dt>Status</dt><dd>${STATUS[clampStatus(info.t.status)]}${info.t.ref ? ' · ' + esc(info.t.ref) : ''}</dd></div>` : ''}<div><dt>Kalender</dt><dd>${b.eventId ? 'Google Kalender „Lernplan“' : 'Wird gerade übertragen'}</dd></div></dl>
      <div class="row"><button class="btn" data-action="moveBlock" data-id="${esc(b.id)}">Verschieben</button><button class="btn primary" data-action="toggleDone" data-id="${esc(b.id)}" data-close="1">${b.done ? 'Doch nicht erledigt' : 'Erledigt'}</button></div>
      <button class="btn danger wide" data-action="dropBlock" data-id="${esc(b.id)}">Lernblock entfernen</button>`);
  }

  function moveSheet(id) {
    const b = findBlock(id);
    if (!b) return;
    const dur = (new Date(b.end) - new Date(b.start)) / 6e4;
    const current = new Date(b.start).getTime();
    const opts = nextSlots(dur, 11, b.id).filter((o) => o.s.getTime() !== current).slice(0, 10);
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">Verschieben</div><h3>${esc(blockInfo(b).title)}</h3></div>${closeBtn()}</div>
      ${opts.length ? `<div class="picks">${opts.map((o) => `<button class="pick" data-action="moveTo" data-id="${esc(b.id)}" data-s="${o.s.toISOString()}" data-e="${o.e.toISOString()}"><span></span><span class="tp-body"><span class="tp-t">${esc(dayLabel(o.s))}, ${hm(o.s)}–${hm(o.e)}</span><span class="tp-ref">${durTxt((o.e - o.s) / 6e4)}</span></span></button>`).join('')}</div>` : '<p class="empty">In den nächsten drei Wochen ist kein Lernfenster frei.</p>'}`);
  }

  function suggSheet(id) {
    const b = S.ui.sugg.find((x) => x.id === id);
    if (!b) return;
    const info = blockInfo(b);
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">Vorschlag</div><h3>${esc(info.title)}</h3></div>${closeBtn()}</div>
      <dl class="facts"><div><dt>Wann</dt><dd>${esc(dateLong(b.s))}, ${hm(b.s)}–${hm(b.e)}</dd></div><div><dt>Modul</dt><dd>${info.m ? esc(modLabel(info.m) + ' · ' + (info.m.short || info.m.name)) : '–'}</dd></div><div><dt>Art</dt><dd>${info.kind}</dd></div></dl>
      <div class="row"><button class="btn" data-action="dropSugg" data-id="${esc(b.id)}">Verwerfen</button><button class="btn primary" data-action="acceptOne" data-id="${esc(b.id)}">Übernehmen</button></div>`);
  }

  function deviceSheet() {
    if (!S.conf) return;
    const link = appUrl() + '#verbinden=' + b64e(JSON.stringify({ u: S.conf.url, k: S.conf.key }));
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">Verbindung teilen</div><h3>Weiteres Gerät verbinden</h3></div>${closeBtn()}</div>
      <p class="lead">Scanne den QR-Code mit der Kamera des anderen Geräts oder öffne dort den Link. Das Gerät ist dann sofort verbunden.</p>
      <div class="qr" id="qr"><span class="spinner"></span></div>
      <input type="text" id="f-link" readonly value="${esc(link)}" aria-label="Verbindungslink">
      <button class="btn primary wide" data-action="copyText" data-text="${esc(link)}">${ICON.copy} Link kopieren</button>
      <p class="note">Der Link enthält deinen geheimen Schlüssel. Teile ihn nur mit dir selbst, zum Beispiel als Nachricht an dich.</p>`);
    loadQr().then(() => { const el = document.getElementById('qr'); if (el) el.innerHTML = qrSvg(link); })
      .catch(() => { const el = document.getElementById('qr'); if (el) el.hidden = true; });
  }

  function loadQr() {
    if (window.qrcode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/qrcode.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function qrSvg(text) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const q = 4;
    const size = n + q * 2;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + q} ${r + q}h1v1h-1z`;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR-Code mit dem Verbindungslink" shape-rendering="crispEdges"><rect width="${size}" height="${size}" style="fill:#fff"/><path d="${path}" style="fill:#000"/></svg>`;
  }

  function copySheet(text) {
    openSheet(`<div class="sheet-h"><div><div class="eyebrow">Kopieren</div><h3>Bitte selbst kopieren</h3></div>${closeBtn()}</div>
      <p class="lead">Dein Browser erlaubt das automatische Kopieren nicht. Markiere den Text und kopiere ihn.</p>
      <textarea id="f-copy" readonly>${esc(text)}</textarea>
      <button class="btn primary wide" data-action="selectCopy">Alles markieren</button>`);
  }

  // ---------- Aktionen ----------

  function prefetchCode() {
    if (S.ui.code || S.ui.codeLoading) return;
    S.ui.codeLoading = true;
    fetch('Code.gs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('fehlt'))))
      .then((t) => { S.ui.code = t; })
      .catch(() => { /* später erneut */ })
      .finally(() => { S.ui.codeLoading = false; });
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch (e) {
      copySheet(text);
    }
  }

  async function copyCode() {
    if (S.ui.code) { copyText(S.ui.code, 'Code kopiert. Öffne jetzt Apps Script und füge ihn ein.'); return; }
    try {
      const r = await fetch('Code.gs', { cache: 'no-store' });
      if (!r.ok) throw new Error('fehlt');
      S.ui.code = await r.text();
      copyText(S.ui.code, 'Code kopiert. Öffne jetzt Apps Script und füge ihn ein.');
    } catch (e) {
      toast('Der Code ließ sich nicht laden. Prüfe deine Internetverbindung.');
    }
  }

  function go(tab) {
    S.ui.tab = tab;
    S.ui.detail = null;
    S.ui.confirm = '';
    render();
    screen.scrollTop = 0;
  }

  function openModule(id) {
    if (!modById(id)) return;
    S.ui.tab = 'module';
    S.ui.detail = id;
    S.ui.dtab = 'themen';
    render();
    screen.scrollTop = 0;
  }

  function toggleBlockDone(id) {
    const b = findBlock(id);
    if (!b) return;
    const t = topicById(b.topicId);
    const ops = [];
    if (!b.done) {
      let prev = null;
      if (t) {
        prev = clampStatus(t.status);
        const next = b.kind === 'wdh' ? Math.min(3, prev + 1) : Math.max(1, prev);
        if (next !== prev) ops.push(topicOp(t, { status: next }));
      }
      ops.push({ op: 'block.update', id: b.id, eventId: b.eventId, start: b.start, patch: { done: true, prev } });
      mutate(...ops);
      const nt = t ? topicById(t.id) : null;
      toast(nt ? `Erledigt. „${trunc(nt.title, 40)}“ ist jetzt ${STATUS[clampStatus(nt.status)]}.` : 'Erledigt.');
    } else {
      if (t && b.prev !== null && b.prev !== undefined) ops.push(topicOp(t, { status: clampStatus(b.prev) }));
      ops.push({ op: 'block.update', id: b.id, eventId: b.eventId, start: b.start, patch: { done: false, prev: null } });
      mutate(...ops);
      toast('Wieder als offen markiert.');
    }
  }

  function acceptSugg(list) {
    if (!list.length) return;
    const ids = new Set(list.map((b) => b.id));
    S.ui.sugg = S.ui.sugg.filter((b) => !ids.has(b.id));
    mutate(...list.map((b) => ({ op: 'block.create', block: { id: b.id, moduleId: b.moduleId, topicId: b.topicId, kind: b.kind, start: b.start, end: b.end, done: false } })));
    toast(list.length === 1 ? 'Im Google Kalender eingetragen.' : list.length + ' Lernblöcke im Google Kalender eingetragen.');
  }

  function moveBlockTo(b, s, e) {
    mutate({ op: 'block.update', id: b.id, eventId: b.eventId, start: b.start, patch: { start: s.toISOString(), end: e.toISOString() } });
    toast('Verschoben auf ' + dayLabel(s) + ', ' + hm(s) + ' Uhr.');
  }

  function disconnect() {
    store.set('oldConf', S.conf);
    S.conf = null;
    store.del('conf');
    S.data = normData(null);
    S.cal = null;
    S.outbox = [];
    S.meta = { lastOk: 0, sheetUrl: '', backend: 0 };
    persist();
    Object.assign(S.ui, { tab: 'heute', detail: null, step: 2, confirm: '', sugg: [], ilias: undefined, connectErr: '' });
    S.sync = { state: 'idle', msg: '' };
    render();
    screen.scrollTop = 0;
  }

  const actions = {
    tab: (el) => go(el.dataset.tab),
    settings: () => { S.ui.tab = 'einst'; S.ui.confirm = ''; S.ui.detail = null; render(); screen.scrollTop = 0; },
    back: () => navBack(),
    syncNow: () => { sync(); },
    step: (el) => {
      S.ui.step = Number(el.dataset.step);
      S.ui.connectErr = '';
      if (S.ui.step === 4) {
        const r = document.querySelector('input[name="f-ilr"]:checked');
        if (r) S.ui.ilias = r.value;
      }
      render();
      screen.scrollTop = 0;
    },
    copyCode: () => copyCode(),
    copyText: (el) => copyText(el.dataset.text, 'Kopiert.'),
    selectCopy: () => { const el = document.getElementById('f-copy'); if (el) { el.focus(); el.select(); } },
    openModule: (el) => openModule(el.dataset.id),
    addModule: () => moduleSheet(null),
    editModule: (el) => moduleSheet(el.dataset.id),
    moduleDone: (el) => { const m = modById(el.dataset.id); if (m) { mutate({ op: 'module.save', module: Object.assign({}, m, { done: true }) }); toast('Modul abgeschlossen.'); } },
    dtab: (el) => { S.ui.dtab = el.dataset.v; render(); },
    cycle: (el) => { const t = topicById(el.dataset.id); if (t) mutate(topicOp(t, { status: (clampStatus(t.status) + 1) % 4 })); },
    openTopic: (el) => topicSheet(el.dataset.id),
    bulkTopics: () => bulkSheet(),
    toggleTask: (el) => {
      const t = taskById(el.dataset.id);
      if (!t) return;
      mutate({ op: 'task.save', task: Object.assign({}, t, { done: !t.done }) });
      toast(t.done ? 'Aufgabe wieder offen.' : 'Aufgabe erledigt.');
    },
    openTask: (el) => taskSheet(el.dataset.id),
    toggleDone: (el) => { if (el.dataset.close) closeSheet(); toggleBlockDone(el.dataset.id); },
    openBlock: (el) => blockSheet(el.dataset.id),
    moveBlock: (el) => moveSheet(el.dataset.id),
    moveTo: (el) => { const b = findBlock(el.dataset.id); if (!b) return; closeSheet(); moveBlockTo(b, new Date(el.dataset.s), new Date(el.dataset.e)); },
    reschedule: (el) => {
      const b = findBlock(el.dataset.id);
      if (!b) return;
      const o = nextSlots((new Date(b.end) - new Date(b.start)) / 6e4, 1, b.id)[0];
      if (!o) { toast('In den nächsten drei Wochen ist kein Lernfenster frei.'); return; }
      moveBlockTo(b, o.s, o.e);
    },
    dropBlock: (el) => {
      const b = findBlock(el.dataset.id);
      if (!b) return;
      closeSheet();
      mutate({ op: 'block.delete', id: b.id, eventId: b.eventId, start: b.start });
      toast('Lernblock entfernt.');
    },
    planSlot: (el) => { ps = { day: el.dataset.day, a: Number(el.dataset.a), b: Number(el.dataset.b), dur: 0, mod: null, topic: null }; planSheet(); },
    psDur: (el) => { ps.dur = Number(el.dataset.v); planSheet(); },
    psMod: (el) => { ps.mod = el.dataset.id; ps.topic = null; planSheet(); },
    psTopic: (el) => { ps.topic = el.dataset.id; planSheet(); },
    psSave: () => {
      const m = modById(ps.mod), t = topicById(ps.topic);
      if (!m || !t) return;
      const day = parseYmd(ps.day);
      const s = at(day, ps.a), e = at(day, ps.a + ps.dur);
      closeSheet();
      mutate({ op: 'block.create', block: { id: uid('b'), moduleId: m.id, topicId: t.id, kind: clampStatus(t.status) === 0 ? 'neu' : 'wdh', start: s.toISOString(), end: e.toISOString(), done: false } });
      toast('Im Google Kalender „Lernplan“ eingetragen.');
    },
    suggest: () => {
      if (!activeMods().some((m) => topicsOf(m.id).length)) { toast('Lege zuerst Module mit Themen an.'); return; }
      const n = makeSuggestions(pageDays());
      selectFirstSugg();
      render();
      toast(n ? n + (n === 1 ? ' Vorschlag' : ' Vorschläge') + ' erstellt.' : 'In dieser Woche ist kein Lernfenster mehr frei.');
    },
    suggestFor: (el) => {
      S.ui.tab = 'plan'; S.ui.page = 0; S.ui.detail = null;
      const n = makeSuggestions(pageDays(), el.dataset.id);
      selectFirstSugg();
      render();
      screen.scrollTop = 0;
      toast(n ? n + (n === 1 ? ' Vorschlag' : ' Vorschläge') + ' erstellt. Prüfe sie und übernimm sie.' : 'In dieser Woche ist kein Lernfenster mehr frei.');
    },
    accept: () => acceptSugg(S.ui.sugg.slice()),
    discard: () => { S.ui.sugg = []; render(); toast('Vorschläge verworfen.'); },
    openSugg: (el) => suggSheet(el.dataset.id),
    acceptOne: (el) => { const b = S.ui.sugg.find((x) => x.id === el.dataset.id); closeSheet(); if (b) acceptSugg([b]); },
    dropSugg: (el) => { S.ui.sugg = S.ui.sugg.filter((x) => x.id !== el.dataset.id); closeSheet(); render(); },
    page: (el) => { S.ui.page = clamp(S.ui.page + Number(el.dataset.dir), 0, 2); S.ui.day = 0; S.ui.sugg = []; render(); },
    selectDay: (el) => { S.ui.day = Number(el.dataset.i); render(); },
    close: () => closeSheet(),
    askDelete: (el) => { const z = document.getElementById('delzone'); if (z) z.innerHTML = delConfirm(el.dataset.kind, el.dataset.id, el.dataset.label); },
    cancelDelete: (el) => { const z = document.getElementById('delzone'); if (z) z.innerHTML = delButton(el.dataset.kind, el.dataset.id, el.dataset.label); },
    del: (el) => {
      const { kind, id } = el.dataset;
      closeSheet();
      if (kind === 'module') {
        if (S.ui.detail === id) S.ui.detail = null;
        mutate({ op: 'module.delete', id });
        toast('Modul gelöscht.');
      } else if (kind === 'topic') {
        mutate({ op: 'topic.delete', id });
        toast('Thema gelöscht.');
      } else if (kind === 'task') {
        mutate({ op: 'task.delete', id });
        toast('Aufgabe gelöscht.');
      }
    },
    connectDevice: () => deviceSheet(),
    confirm: (el) => { S.ui.confirm = el.dataset.what || ''; render(); },
    disconnect: () => disconnect()
  };

  const forms = {
    connect: async () => {
      const url = String(document.getElementById('f-url').value || '').trim().replace(/\/$/, '');
      S.ui.drafts['f-url'] = url;
      S.ui.connectErr = '';
      const ok = /^https:\/\/script\.google\.com\/(macros|a\/macros\/[^/]+)\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) || (isLocal() && /\/exec$/.test(url));
      if (!ok) {
        S.ui.connectErr = /\/dev$/.test(url)
          ? 'Das ist die Test-URL (endet auf /dev). Nimm die Web-App-URL aus „Bereitstellen“, sie endet auf /exec.'
          : 'Das sieht nicht wie eine Web-App-URL aus. Sie beginnt mit https://script.google.com/macros/s/ und endet auf /exec.';
        render();
        return;
      }
      S.ui.connecting = true;
      render();
      const old = store.get('oldConf', null);
      const key = old && old.url === url ? old.key : (store.get('pendingKey', null) || rand(32));
      store.set('pendingKey', key);
      try {
        const res = await rawApi(url, { action: 'pair', key, client: APP_VERSION });
        if (!res || !res.ok) throw Object.assign(new Error((res && res.error) || 'Verbindung fehlgeschlagen.'), { code: (res && res.code) || 'server' });
        S.conf = { url, key };
        store.set('conf', S.conf);
        store.del('pendingKey');
        store.del('oldConf');
        S.meta.backend = res.version || 0;
        S.ui.drafts['f-url'] = '';
        S.ui.step = 3;
        S.ui.tab = 'setup';
        S.ui.connecting = false;
        persist();
        render();
        sync();
      } catch (e) {
        S.ui.connecting = false;
        S.ui.connectErr = netMessage(e);
        render();
      }
    },
    setupTimes: () => {
      const { s, errs } = readSettingsForm(cfg());
      if (errs.length) { showFormErrors(errs); return; }
      const cals = (S.cal && S.cal.calendars) || [];
      const primary = (S.cal && S.cal.primaryId) || (cals.find((x) => x.primary) || {}).id || '';
      s.iliasCalendarId = S.ui.ilias || '';
      s.busyCalendarIds = [primary, s.iliasCalendarId].filter(Boolean);
      s.einrichtungFertig = true;
      S.ui.tab = 'module';
      S.ui.step = 0;
      mutate({ op: 'settings.save', settings: s });
      screen.scrollTop = 0;
      toast('Eingerichtet. Lege jetzt deine Module an.');
    },
    settings: () => {
      const { s, errs } = readSettingsForm(cfg());
      if (errs.length) { showFormErrors(errs); return; }
      S.ui.sugg = [];
      mutate({ op: 'settings.save', settings: s });
      toast('Einstellungen gespeichert.');
    },
    module: (form) => {
      const id = form.dataset.id;
      const name = String(document.getElementById('f-mname').value || '').trim();
      const exam = document.getElementById('f-mex').value || '';
      const nrRaw = parseInt(document.getElementById('f-mnr').value, 10);
      const done = document.getElementById('f-mdone').checked;
      const err = (t) => { const e = document.getElementById('f-merr'); e.textContent = t; e.hidden = false; };
      if (!name) { err('Gib dem Modul einen Namen.'); return; }
      if (!exam && !done) { err('Wähle das Klausurdatum. Daraus rechnet die App rückwärts, wann du anfangen solltest.'); return; }
      const color = (form.querySelector('input[name="f-mcol"]:checked') || {}).value || 'm1';
      const short = String(document.getElementById('f-mshort').value || '').trim() || name;
      const base = id ? modById(id) : null;
      const mod = Object.assign({}, base || {}, { id: id || uid('m'), nr: isNaN(nrRaw) ? null : nrRaw, name, short, color, exam, done });
      closeSheet();
      mutate({ op: 'module.save', module: mod });
      if (!id) { openModule(mod.id); toast('Modul angelegt. Füge jetzt die Themen hinzu.'); }
      else toast('Gespeichert.');
    },
    topic: (form) => {
      const t = topicById(form.dataset.id);
      if (!t) return;
      const title = String(document.getElementById('f-tt').value || '').trim();
      if (!title) { const e = document.getElementById('f-terr'); e.textContent = 'Das Thema braucht einen Titel.'; e.hidden = false; return; }
      const ref = String(document.getElementById('f-tr').value || '').trim();
      const st = Number((form.querySelector('input[name="f-ts"]:checked') || {}).value || 0);
      const patch = { title, ref };
      if (st !== clampStatus(t.status)) patch.status = st;
      closeSheet();
      mutate(topicOp(t, patch));
      toast('Gespeichert.');
    },
    task: (form) => {
      const t = taskById(form.dataset.id);
      if (!t) return;
      const title = String(document.getElementById('f-kt').value || '').trim();
      if (!title) { const e = document.getElementById('f-kerr'); e.textContent = 'Die Aufgabe braucht einen Titel.'; e.hidden = false; return; }
      closeSheet();
      mutate({ op: 'task.save', task: Object.assign({}, t, { title, due: document.getElementById('f-kd').value || '', done: document.getElementById('f-kdone').checked }) });
      toast('Gespeichert.');
    },
    bulk: () => {
      const m = modById(S.ui.detail);
      if (!m) return;
      const items = String(document.getElementById('f-bulk').value || '').split(/\r?\n/).map(parseTopicLine).filter(Boolean);
      if (!items.length) { toast('Keine Themen erkannt.'); return; }
      let order = nextOrder(m.id);
      closeSheet();
      mutate(...items.map((p) => ({ op: 'topic.save', topic: { id: uid('t'), moduleId: m.id, title: p.title, ref: p.ref, status: 0, order: order++, updated: '' } })));
      toast(items.length + (items.length === 1 ? ' Thema' : ' Themen') + ' hinzugefügt.');
    },
    topicAdd: () => {
      const m = modById(S.ui.detail);
      const p = parseTopicLine(document.getElementById('f-topic').value);
      if (!m || !p) return;
      S.ui.drafts['f-topic'] = '';
      mutate({ op: 'topic.save', topic: { id: uid('t'), moduleId: m.id, title: p.title, ref: p.ref, status: 0, order: nextOrder(m.id), updated: '' } });
      const el = document.getElementById('f-topic');
      if (el) el.focus();
    },
    taskAdd: () => {
      const title = String(document.getElementById('f-task').value || '').trim();
      if (!title || !S.ui.detail) return;
      const due = document.getElementById('f-due').value || '';
      S.ui.drafts['f-task'] = '';
      mutate({ op: 'task.save', task: { id: uid('a'), moduleId: S.ui.detail, title, due, done: false } });
      toast('Aufgabe hinzugefügt.');
    }
  };

  function parseTopicLine(line) {
    let s = String(line || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/\s*\.{3,}\s*\d*\s*$/, '').replace(/\s*…+\s*\d*\s*$/, '');
    s = s.replace(/^[•▪●◦·*–—-]\s*/, '');
    s = s.replace(/^(?:(?:\d+[.)]?)+(?:\.\d+)*|[A-Za-z][.)]|[IVXLC]+[.)])\s+/, '');
    s = s.trim();
    if (!s) return null;
    let title = s;
    let ref = '';
    const i = s.search(/\s\(?\s*(?:§§?|Art\.)\s*\d/);
    if (i > 0) {
      title = s.slice(0, i).replace(/[\s,;:(–-]+$/, '').trim();
      ref = s.slice(i).trim().replace(/^\(\s*/, '');
      if (ref.endsWith(')') && !ref.includes('(')) ref = ref.slice(0, -1).trim();
      if (!title) { title = s; ref = ''; }
    }
    return { title: title.slice(0, 200), ref: ref.slice(0, 120) };
  }

  // ---------- Rendern & Start ----------

  function render() {
    if (S.ui.detail && !modById(S.ui.detail)) S.ui.detail = null;
    const setup = !S.conf || S.ui.tab === 'setup';
    document.getElementById('tabbar').hidden = setup;
    const active = document.activeElement;
    const keep = active && active.id && screen.contains(active) && /^(INPUT|TEXTAREA)$/.test(active.tagName)
      ? { id: active.id, s: active.selectionStart, e: active.selectionEnd } : null;
    let html;
    try {
      if (setup) html = viewSetup();
      else if (S.ui.tab === 'module') html = S.ui.detail ? viewDetail() : viewModules();
      else if (S.ui.tab === 'plan') html = viewPlan();
      else if (S.ui.tab === 'zeit') html = viewZeit();
      else if (S.ui.tab === 'einst') html = viewSettings();
      else html = viewHeute();
    } catch (err) {
      console.error(err);
      html = `<div class="view"><div class="alert bad"><p><b>Hier ist etwas schiefgelaufen.</b> ${esc(err && err.message)}</p><button class="btn small" data-action="tab" data-tab="heute">Zur Startseite</button></div></div>`;
    }
    screen.innerHTML = html;
    if (keep) {
      const el = document.getElementById(keep.id);
      if (el) {
        el.focus({ preventScroll: true });
        try { if (keep.s !== null && keep.s !== undefined) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* nicht jedes Feld kann das */ }
      }
    }
    const current = S.ui.tab === 'einst' ? 'heute' : S.ui.tab;
    $$('.tab').forEach((t) => t.setAttribute('aria-current', !setup && t.dataset.tab === current ? 'page' : 'false'));
    nav.update();
  }

  function boot() {
    const h = location.hash || '';
    if (h.indexOf('#verbinden=') === 0) {
      try {
        const j = JSON.parse(b64d(h.slice('#verbinden='.length)));
        if (j && j.u && j.k) {
          const same = S.conf && S.conf.url === j.u && S.conf.key === j.k;
          if (!same) {
            S.conf = { url: j.u, key: j.k };
            store.set('conf', S.conf);
            S.data = normData(null);
            S.cal = null;
            S.outbox = [];
            S.meta = { lastOk: 0, sheetUrl: '', backend: 0 };
            persist();
          }
        }
      } catch (e) { /* ungültiger Link */ }
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (S.conf && !cfg().einrichtungFertig) { S.ui.tab = 'setup'; S.ui.step = 3; }

    const app = document.getElementById('app');
    app.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-action]');
      if (!el || el.disabled) return;
      const fn = actions[el.dataset.action];
      if (!fn) return;
      if (el.tagName === 'A') return;
      ev.preventDefault();
      fn(el, ev);
    });
    app.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fn = forms[ev.target.dataset.form];
      if (fn) fn(ev.target);
    });
    app.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset && t.dataset.draft !== undefined && t.id) S.ui.drafts[t.id] = t.value;
      if (t.id === 'f-bulk') {
        const n = String(t.value || '').split(/\r?\n/).map(parseTopicLine).filter(Boolean).length;
        const c = document.getElementById('f-bcount');
        if (c) c.textContent = n ? n + (n === 1 ? ' Thema erkannt.' : ' Themen erkannt.') : 'Noch keine Themen erkannt.';
      }
    });
    app.addEventListener('change', (ev) => {
      if (ev.target.name === 'f-ilr') S.ui.ilias = ev.target.value;
    });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !sheet.hidden) closeSheet(); });
    window.addEventListener('popstate', () => nav.onPop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (S.conf && Date.now() - (S.meta.lastOk || 0) > 60000) sync();
      else renderSyncLine();
    });
    window.addEventListener('online', () => { if (S.conf) sync(); });
    setInterval(() => { if (document.visibilityState === 'visible') renderSyncLine(); }, 30000);

    render();
    if (S.conf) sync();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Modus weiter */ });
    }
  }

  boot();
})();
