'use strict';
/*
 * End-to-End-Test: klickt die App im Browser gegen den Testserver durch.
 *   TZ=Europe/Berlin node tests/server.js &
 *   node tests/e2e.js            (SHOTS=<Ordner> speichert Bildschirmfotos)
 */
process.env.TZ = 'Europe/Berlin';
const assert = require('assert');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '';
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = new Date();
const day = (n, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, h || 0, m || 0);

const M4 = ['Maßgeblichkeit § 5 Abs. 1 EStG', 'Wirtschaftsgut und Zurechnung § 39 AO', 'Anschaffungskosten § 255 Abs. 1 HGB', 'Herstellungskosten § 255 Abs. 2 HGB',
  'Absetzung für Abnutzung § 7 EStG', 'Teilwertabschreibung § 6 Abs. 1 Nr. 1 EStG', 'Rückstellungen § 249 HGB', 'Rechnungsabgrenzung § 5 Abs. 5 EStG',
  'Entnahmen und Einlagen § 4 Abs. 1 EStG', 'Rücklage für Veräußerungsgewinne § 6b EStG', 'Pensionsrückstellungen § 6a EStG', 'Ergänzungsbilanzen',
  'Sonderbilanzen § 15 Abs. 1 Nr. 2 EStG', 'Betriebsaufspaltung', 'Umwandlungen', 'Bilanzberichtigung § 4 Abs. 2 EStG'];
const M3 = ['1. Steuerbarkeit § 1 UStG', '2.1 Unternehmer (§ 2 UStG) ........ 12', '2.2 Lieferung und sonstige Leistung § 3 UStG', '3 Ort der Lieferung § 3 Abs. 6–8 UStG',
  '• Ort der sonstigen Leistung § 3a UStG', '- Reihengeschäfte § 3 Abs. 6a UStG', 'Innergemeinschaftlicher Erwerb § 1a UStG', 'Steuerbefreiungen § 4 UStG',
  'Verzicht auf Steuerbefreiungen § 9 UStG', 'Bemessungsgrundlage § 10 UStG', 'Steuersätze § 12 UStG', 'Entstehung der Steuer § 13 UStG',
  'Steuerschuldnerschaft des Leistungsempfängers § 13b UStG', 'Rechnungsanforderungen § 14 UStG', 'Vorsteuerabzug § 15 UStG', 'Berichtigung des Vorsteuerabzugs § 15a UStG'];
const M5 = ['Persönliche Steuerpflicht § 2 ErbStG', 'Erwerb von Todes wegen § 3 ErbStG', 'Schenkungen unter Lebenden § 7 ErbStG', 'Steuerklassen § 15 ErbStG',
  'Freibeträge §§ 16, 17 ErbStG', 'Steuersätze § 19 ErbStG', 'Bewertung von Grundvermögen §§ 176 ff. BewG', 'Bewertung von Betriebsvermögen §§ 199 ff. BewG',
  'Verschonung von Betriebsvermögen §§ 13a, 13b ErbStG', 'Familienheim § 13 Abs. 1 Nr. 4a–4c ErbStG', 'Zusammenrechnung früherer Erwerbe § 14 ErbStG', 'Anzeige- und Erklärungspflichten §§ 30, 31 ErbStG'];

(async () => {
  await fetch(BASE + '__reset', { method: 'POST' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
  const page = await ctx.newPage();
  const errors = [];
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push('Seitenfehler: ' + e.message));
    p.on('console', (m) => {
      // Ohne Netz meldet der Browser fehlgeschlagene Anfragen – das ist im Offline-Test erwartet.
      if (m.type() === 'error' && !m.text().includes('ERR_INTERNET_DISCONNECTED')) errors.push('Konsole: ' + m.text());
    });
  };
  watch(page);
  let shotNr = 0;
  const shot = async (name, p) => { if (SHOTS) await (p || page).screenshot({ path: SHOTS + '/' + pad(++shotNr) + '-' + name + '.png' }); };
  const state = async () => (await fetch(BASE + '__state')).json();
  const synced = (p) => (p || page).waitForFunction(() => JSON.parse(localStorage.getItem('sp:outbox') || '[]').length === 0 && !document.querySelector('.sdot.busy'), null, { timeout: 20000 });
  const tab = (name) => page.click('.tab[data-tab="' + name + '"]');
  const lernplan = (s) => s.calendars.find((c) => c.name === 'Lernplan');
  const settingsOf = (s) => Object.fromEntries(s.sheets['Einstellungen'].slice(1).map(([k, v]) => [k, JSON.parse(v)]));
  let passed = 0;
  const ok = (msg) => { passed += 1; console.log('  ✓ ' + msg); };

  // ---------- Einrichtung ----------
  await page.goto(BASE);
  await shot('willkommen');
  await page.getByRole('button', { name: 'Einrichtung starten' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Code kopieren/ }).click();
  let clip = '';
  for (let i = 0; i < 20 && !clip.includes('function doPost'); i++) {
    await page.waitForTimeout(150);
    clip = await page.evaluate(() => navigator.clipboard.readText());
  }
  assert.ok(clip.includes('function doPost'), 'Code wurde nicht kopiert');
  ok('Code für das Google-Skript in die Zwischenablage kopiert');
  await shot('einrichtung-skript');

  await page.getByRole('button', { name: 'Weiter: URL einfügen' }).click();
  await page.fill('#f-url', 'https://script.google.com/macros/s/ABC123/dev');
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await page.getByText('Das ist die Test-URL').waitFor();
  ok('Test-URL (/dev) wird mit verständlichem Hinweis abgelehnt');

  await page.fill('#f-url', BASE + 'macros/s/TEST/exec');
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await page.getByText('ILIAS Studium').waitFor({ timeout: 15000 });
  assert.ok(await page.locator('label.radio', { hasText: 'ILIAS Studium' }).locator('input').isChecked(), 'ILIAS-Kalender sollte vorausgewählt sein');
  ok('verbunden; ILIAS-Kalender wird erkannt und vorausgewählt');
  await shot('einrichtung-kalender');

  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('heading', { name: 'Deine Zeiten' }).waitFor();
  assert.strictEqual(await page.inputValue('#f-av'), '06:00');
  assert.strictEqual(await page.inputValue('#f-ab'), '15:30');
  await shot('einrichtung-zeiten');
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.getByText('Noch keine offenen Module').waitFor();
  await synced();
  let s = await state();
  let st = settingsOf(s);
  const iliasCal = s.calendars.find((c) => c.name === 'ILIAS Studium');
  assert.strictEqual(st.einrichtungFertig, true);
  assert.strictEqual(st.iliasCalendarId, iliasCal.id);
  assert.deepStrictEqual(st.busyCalendarIds, ['primary@example.com', iliasCal.id]);
  assert.deepStrictEqual(st.arbeit, { tage: [1, 2, 3, 4, 5], von: '06:00', bis: '15:30' });
  ok('Einrichtung in der Google-Tabelle gespeichert');

  // ---------- Module ----------
  async function addModule(nr, name, offset, lines, statuses) {
    await tab('module');
    await page.locator('.iconbtn[aria-label="Modul hinzufügen"]').click();
    await page.fill('#f-mnr', String(nr));
    await page.fill('#f-mname', name);
    await page.fill('#f-mex', ymd(day(offset)));
    await page.locator('#sheet').getByRole('button', { name: 'Modul anlegen' }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Mehrere Themen einfügen' }).click();
    await page.fill('#f-bulk', lines.join('\n'));
    await page.getByText(lines.length + ' Themen erkannt.').waitFor();
    await page.getByRole('button', { name: 'Themen hinzufügen' }).click();
    await page.locator('.topic').nth(lines.length - 1).waitFor();
    for (let i = 0; i < (statuses || []).length; i++) {
      for (let k = 0; k < statuses[i]; k++) await page.locator('.topic .ringbtn').nth(i).click();
    }
  }
  await addModule(4, 'Bilanzsteuerrecht', 54, M4, [3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1]);
  await shot('modul-detail');
  await addModule(3, 'Umsatzsteuer', 75, M3, [2, 1]);
  await addModule(5, 'Erbschaft- und Schenkungsteuer', 150, M5);
  await synced();
  s = await state();
  const themen = s.sheets['Themen'];
  assert.strictEqual(themen.length - 1, M4.length + M3.length + M5.length);
  const row = (title) => themen.find((r) => r[4] === title);
  assert.deepStrictEqual([row('Steuerbarkeit')[5], row('Unternehmer')[5], row('Ort der Lieferung')[5], row('Reihengeschäfte')[5], row('Ort der sonstigen Leistung')[5]],
    ['§ 1 UStG', '§ 2 UStG', '§ 3 Abs. 6–8 UStG', '§ 3 Abs. 6a UStG', '§ 3a UStG']);
  assert.strictEqual(row('Maßgeblichkeit')[6], 'sitzt');
  assert.strictEqual(row('Rechnungsabgrenzung')[6], 'gelernt');
  assert.strictEqual(lernplan(s).events.filter((e) => e.tags.sp_exam).length, 3);
  ok('3 Module mit 44 Themen angelegt; Nummern, Punktlinien und Fundstellen werden sauber getrennt');

  await tab('module');
  await shot('module');
  await tab('heute');
  await page.getByText('Wird knapp').first().waitFor();
  assert.ok(await page.getByText('Jetzt feste Lernblöcke einplanen.').isVisible());
  ok('Frühwarnung: Modul 3 wird knapp');
  await shot('heute-vorher');

  // ---------- Plan ----------
  await page.getByRole('button', { name: 'Lernblöcke vorschlagen' }).click();
  await page.locator('.suggest').waitFor();
  const nSugg = await page.locator('.wk .wb.sugg').count();
  assert.ok(nSugg >= 4, 'zu wenige Vorschläge: ' + nSugg);
  await shot('plan-vorschlaege');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await synced();
  s = await state();
  let blocks = lernplan(s).events.filter((e) => e.tags.sp);
  assert.strictEqual(blocks.length, nSugg);
  const onDay = (n) => blocks.filter((b) => ymd(new Date(b.start)) === ymd(day(n)));
  const seeded = s.seeded;
  if (seeded.thu <= 6) assert.strictEqual(onDay(seeded.thu).length, 0, 'Donnerstag: ILIAS-Termin blockiert das Lernfenster');
  if (seeded.wed <= 6) assert.strictEqual(onDay(seeded.wed).length, 0, 'Mittwoch: Zahnarzt lässt kein 45-Minuten-Fenster');
  if (seeded.fri <= 6) assert.ok(onDay(seeded.fri).some((b) => new Date(b.start).getHours() === 9), 'Freitag: Urlaub wird wie Wochenende geplant');
  blocks.forEach((b) => {
    const t = JSON.parse(b.tags.sp);
    const h = new Date(b.start).getHours() + new Date(b.start).getMinutes() / 60;
    const wd = new Date(b.start).getDay();
    const free = ymd(new Date(b.start)) === ymd(day(seeded.fri)) || wd === 0 || wd === 6;
    assert.ok(free ? h >= 9.5 : h >= 17, 'Block in Arbeitszeit: ' + b.start);
    assert.ok(t.id && t.m && t.t && (t.k === 'neu' || t.k === 'wdh'));
  });
  const firstM3 = blocks.map((b) => JSON.parse(b.tags.sp)).find((t) => t.k === 'neu');
  assert.ok(firstM3, 'es sollten neue Themen eingeplant werden');
  ok(nSugg + ' Vorschläge übernommen; Arbeit, ILIAS, Zahnarzt und Urlaub werden berücksichtigt');

  // manuell planen in der nächsten Woche
  await page.locator('button[aria-label="Nächste Woche"]').click();
  await page.locator('.tls .tl.free').first().click();
  await page.locator('.sheet .pick').first().click();
  await page.getByRole('button', { name: 'In Google Kalender eintragen' }).click();
  await synced();
  s = await state();
  assert.strictEqual(lernplan(s).events.filter((e) => e.tags.sp).length, nSugg + 1);
  ok('Lernblock manuell in ein freies Zeitfenster eingetragen');

  // abhaken
  await page.locator('button[aria-label="Vorherige Woche"]').click();
  const idx = await page.evaluate(() => Array.from(document.querySelectorAll('.wk-col')).findIndex((c) => c.querySelector('.wb.block')));
  await page.locator('.wk-d').nth(idx).click();
  const blockRow = page.locator('.tls .tl.block').first();
  const blockTitle = await blockRow.locator('.tx').innerText();
  await blockRow.locator('.check').click();
  await synced();
  s = await state();
  assert.ok(lernplan(s).events.some((e) => e.title === '✓ ' + blockTitle + ' · Modul ' + (e.title.split('Modul ')[1] || '')), 'Haken im Kalendertitel fehlt');
  assert.notStrictEqual(s.sheets['Themen'].find((r) => r[4] === blockTitle)[6], 'offen');
  ok('Lernblock abgehakt; Thema rückt in der Tabelle eine Stufe weiter');

  // verschieben
  await page.locator('.tls .tl.block .tl-body').first().click();
  await page.getByRole('button', { name: 'Verschieben' }).click();
  const target = page.locator('.sheet .pick').first();
  const targetLabel = await target.locator('.tp-t').innerText();
  await target.click();
  await synced();
  ok('Lernblock verschoben auf ' + targetLabel);

  // ---------- verpasster Block ----------
  await page.evaluate(async () => {
    const conf = JSON.parse(localStorage.getItem('sp:conf'));
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(17, 0, 0, 0);
    const e = new Date(d); e.setHours(18, 30);
    await fetch(conf.url, { method: 'POST', body: JSON.stringify({ action: 'sync', key: conf.key, ops: [{ op: 'block.create', block: { id: 'b_gestern', moduleId: '', topicId: '', kind: 'neu', start: d.toISOString(), end: e.toISOString() } }] }) });
  });
  await tab('heute');
  await page.click('#syncline');
  await page.getByRole('heading', { name: 'Verpasst' }).waitFor();
  await shot('heute-verpasst');
  await page.locator('.miss').first().getByRole('button', { name: 'Neu planen' }).click();
  await synced();
  s = await state();
  const moved = lernplan(s).events.find((e) => JSON.parse(e.tags.sp || '{}').id === 'b_gestern');
  assert.ok(new Date(moved.start) > new Date(), 'verpasster Block wurde nicht in die Zukunft verschoben');
  ok('verpasster Lernblock wird angezeigt und neu geplant');

  // ---------- Aufgaben ----------
  await tab('module');
  await page.locator('.mcard', { hasText: 'Bilanzsteuerrecht' }).click();
  await page.getByRole('button', { name: /^Aufgaben/ }).click();
  await page.fill('#f-task', 'Übungsklausur 1 bearbeiten');
  await page.fill('#f-due', ymd(day(3)));
  await page.locator('form[data-form="taskAdd"] button[type="submit"]').click();
  await page.locator('.task', { hasText: 'Übungsklausur 1 bearbeiten' }).waitFor();
  await synced();
  await tab('heute');
  await page.locator('.task', { hasText: 'Übungsklausur 1 bearbeiten' }).waitFor();
  ok('Aufgabe angelegt und unter „Fällige Aufgaben“ angezeigt');
  await page.evaluate(() => { document.getElementById('screen').scrollTop = 0; });
  await shot('heute');

  // ---------- Zurück-Taste ----------
  await tab('module');
  await page.locator('.mcard', { hasText: 'Umsatzsteuer' }).click();
  await page.getByRole('heading', { name: 'Umsatzsteuer', exact: true }).waitFor();
  await page.locator('.topic .tp-body').first().click();
  await page.getByRole('heading', { name: 'Thema bearbeiten' }).waitFor();
  await page.goBack();
  await page.waitForSelector('#sheet', { state: 'hidden' });
  assert.ok(await page.getByRole('heading', { name: 'Umsatzsteuer', exact: true }).isVisible());
  await page.goBack();
  await page.getByRole('heading', { name: 'Module', exact: true }).waitFor();
  ok('Zurück-Taste schließt erst das Sheet, dann die Moduldetails');

  // Thema löschen
  await page.locator('.mcard', { hasText: 'Erbschaft' }).click();
  const before = await page.locator('.topic').count();
  await page.locator('.topic .tp-body').last().click();
  await page.getByRole('button', { name: 'Thema löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await page.waitForFunction((n) => document.querySelectorAll('.topic').length === n - 1, before);
  await synced();
  ok('Thema gelöscht (mit Rückfrage)');

  // ---------- Zeitplan ----------
  await tab('zeit');
  await page.locator('.gantt svg').waitFor();
  assert.strictEqual(await page.locator('.crow').count(), 3);
  await shot('zeitplan');
  ok('Zeitplan und Rückwärtsrechner für 3 Module');

  // ---------- Einstellungen ----------
  await tab('heute');
  await page.locator('button[aria-label="Einstellungen"]').click();
  await page.getByRole('heading', { name: 'Einstellungen' }).waitFor();
  await page.fill('#f-lwv', '19:00');
  await page.fill('#f-lwb', '18:00');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await page.getByText('Bitte prüfe: Lernzeit an Arbeitstagen').waitFor();
  await page.fill('#f-lwv', '18:00');
  await page.fill('#f-lwb', '19:30');
  await page.fill('#f-uk', 'Urlaub, Feiertag');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await synced();
  s = await state();
  st = settingsOf(s);
  assert.deepStrictEqual(st.lernenWerktags, [{ von: '18:00', bis: '19:30' }]);
  assert.deepStrictEqual(st.urlaubStichwoerter, ['Urlaub', 'Feiertag']);
  ok('Einstellungen prüfen Zeiten und landen in der Tabelle');
  await page.evaluate(() => { document.getElementById('screen').scrollTop = 0; });
  await shot('einstellungen');

  // ---------- zweites Gerät ----------
  await page.getByRole('button', { name: 'Weiteres Gerät verbinden' }).click();
  await page.locator('#qr svg').waitFor();
  const link = await page.inputValue('#f-link');
  await shot('geraet-verbinden');
  await page.keyboard.press('Escape');
  const ctx2 = await browser.newContext({ viewport: { width: 400, height: 860 }, timezoneId: 'Europe/Berlin', locale: 'de-DE', colorScheme: 'dark' });
  const page2 = await ctx2.newPage();
  watch(page2);
  await page2.goto(link);
  await page2.locator('.ringcard').first().waitFor({ timeout: 15000 });
  assert.strictEqual(await page2.locator('.ringcard').count(), 3);
  assert.ok(!(await page2.evaluate(() => location.hash)), 'Schlüssel darf nicht in der Adresse bleiben');
  ok('zweites Gerät per Link verbunden, ohne neue Einrichtung');
  await shot('zweites-geraet-dunkel', page2);
  await page2.click('.tab[data-tab="plan"]');
  await shot('plan-dunkel', page2);

  // ---------- Neu laden (offline-Start aus dem Speicher) ----------
  await page.reload();
  await page.locator('.ringcard').first().waitFor();
  ok('nach dem Neuladen sofort da (aus dem Gerätespeicher)');

  // ---------- ohne Netz ----------
  await ctx.setOffline(true);
  await tab('module');
  await page.locator('.mcard', { hasText: 'Umsatzsteuer' }).click();
  const offTitle = await page.locator('.topic .tp-t').nth(5).innerText();
  await page.locator('.topic .ringbtn').nth(5).click();
  await tab('heute');
  await page.getByText('Offline · 1 Änderung wartet').waitFor({ timeout: 10000 });
  s = await state();
  assert.strictEqual(s.sheets['Themen'].find((r) => r[4] === offTitle)[6], 'offen', 'darf ohne Netz noch nicht in Google sein');
  await ctx.setOffline(false);
  await synced();
  s = await state();
  assert.strictEqual(s.sheets['Themen'].find((r) => r[4] === offTitle)[6], 'gelernt');
  ok('ohne Netz: Änderung wartet und wird übertragen, sobald das Handy wieder online ist');

  // ---------- Modul löschen ----------
  await tab('module');
  await page.locator('.mcard', { hasText: 'Erbschaft' }).click();
  await page.locator('button[aria-label="Modul bearbeiten"]').click();
  await page.getByRole('button', { name: 'Modul löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await page.getByRole('heading', { name: 'Module', exact: true }).waitFor();
  await synced();
  s = await state();
  assert.strictEqual(s.sheets['Module'].length - 1, 2);
  assert.strictEqual(lernplan(s).events.filter((e) => e.tags.sp_exam).length, 2);
  ok('Modul gelöscht, Klausurtermin entfernt');

  await browser.close();
  if (errors.length) {
    console.error('Fehler im Browser:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('End-to-End: ' + passed + ' Schritte bestanden');
})().catch((e) => { console.error(e); process.exit(1); });
