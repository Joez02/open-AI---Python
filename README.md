# Studienplaner

Eine App für das berufsbegleitende Studium: Lernpläne, Themenübersicht und Termine an einem Ort, abgeglichen mit Google Kalender. Gedacht fürs Android-Handy, läuft aber auch am PC.

- **Einrichtung für Nutzer:** [ANLEITUNG.md](ANLEITUNG.md)
- **Vision und Konzept:** [VISION.md](VISION.md)
- **Klickbarer Entwurf (Prototyp):** [prototyp/studienplaner.html](prototyp/studienplaner.html)

## Aufbau

| Ordner | Inhalt |
|---|---|
| `app/` | Die App (PWA, reines HTML/CSS/JavaScript ohne Build-Schritt): `index.html`, `styles.css`, `app.js`, `sw.js` (Offline-Speicher), `manifest.webmanifest`, Icons, Schriften, `vendor/qrcode.js` (MIT) |
| `backend/Code.gs` | Google-Apps-Script, das der Nutzer in sein Google-Konto kopiert. Es speichert Daten in der Google-Tabelle „Studienplaner“ und Lernblöcke im Kalender „Lernplan“ und liest Termine und Urlaub. |
| `tests/` | Nachbau der Google-Dienste (`gas-mock.js`), lokaler Testserver, Backend-Tests und End-to-End-Test |
| `.github/workflows/pages.yml` | Veröffentlicht `app/` auf GitHub Pages, sobald etwas in `main` landet |

## So funktioniert der Abgleich

1. Die App hält alle Daten zusätzlich im Gerätespeicher und startet dadurch sofort, auch offline.
2. Jede Änderung wird als kleine Änderungsanweisung (`module.save`, `topic.save`, `block.create` …) in eine Warteschlange gelegt.
3. Die Warteschlange geht per `POST` (als `text/plain`, damit kein CORS-Preflight nötig ist) an die Web-App-URL des Google-Skripts. Das Skript wendet die Änderungen an und antwortet mit dem vollständigen aktuellen Stand: Tabelle plus Kalenderausschnitt der letzten 7 und nächsten 22 Tage.
4. Geschützt ist das Skript durch einen Schlüssel, den die App beim ersten Verbinden erzeugt (`pair`). Weitere Geräte bekommen ihn über einen Link oder QR-Code.

Lernblöcke sind Termine im Kalender „Lernplan“ mit einem privaten Tag `sp` (JSON: `id`, Modul `m`, Thema `t`, Art `k`, erledigt `d`, vorheriger Status `p`). Klausuren sind ganztägige Termine mit dem Tag `sp_exam`.

## Entwickeln und testen

```bash
node tests/backend.test.js                      # Google-Skript gegen nachgebaute Google-Dienste
TZ=Europe/Berlin node tests/server.js &         # App + Skript lokal auf http://localhost:8787/
node tests/e2e.js                               # Durchlauf im Browser (Playwright); SHOTS=<Ordner> für Bildschirmfotos
```

Im lokalen Testserver lautet die Web-App-URL `http://localhost:8787/macros/s/TEST/exec`.

Ändert sich das Format zwischen App und Skript, `VERSION` in `backend/Code.gs` und `NEEDS_BACKEND` in `app/app.js` erhöhen. Die App bittet den Nutzer dann, das Skript zu aktualisieren. Bei Änderungen an App-Dateien die Cache-Version in `app/sw.js` erhöhen.
