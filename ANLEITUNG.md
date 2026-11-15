# Studienplaner einrichten

Die Einrichtung machst du einmal, sie dauert insgesamt etwa 30 Minuten. Programmieren musst du nichts: Du klickst dich durch und kopierst an einer Stelle Code hinein.

| Teil | Was passiert | Wo | Dauer |
|---|---|---|---|
| 1 | App online stellen | GitHub, am PC | 5 Min. |
| 2 | Google-Skript anlegen und verbinden | in der App, am PC | 10 Min. |
| 3 | ILIAS-Termine in den Google Kalender holen | ILIAS und Google Kalender, am PC | 5 Min. |
| 4 | App aufs Handy holen | Android-Handy | 5 Min. |

---

## Teil 1: App online stellen (GitHub Pages)

Die App ist eine Webseite, die sich wie eine normale App installieren lässt. GitHub stellt sie kostenlos bereit.

1. **Repository öffentlich machen** (nur nötig, wenn es privat ist): Öffne auf GitHub dein Repository `open-AI---Python` → **Settings** → ganz unten **Danger Zone** → **Change repository visibility** → **Public**.
   *Öffentlich ist nur der Programmcode. Deine Module, Themen und Termine liegen in deinem Google-Konto, nicht auf GitHub.*
2. **Pages einschalten:** **Settings** → **Pages** → bei **Build and deployment** unter **Source** die Option **GitHub Actions** wählen.
3. **App-Code übernehmen:** Den Pull Request mit der App öffnen und auf **Merge pull request** klicken.
4. Unter **Actions** läuft jetzt „App veröffentlichen“ (1–2 Minuten). Danach ist die App erreichbar unter:
   **https://joez02.github.io/open-AI---Python/**

Falls „App veröffentlichen“ fehlschlägt, weil Pages noch nicht eingeschaltet war: Schritt 2 erledigen, dann unter **Actions** → **App veröffentlichen** → **Run workflow** erneut starten.

---

## Teil 2: Google-Skript anlegen und verbinden

Öffne die App-Adresse am PC im Browser. Die App führt dich durch vier Schritte:

1. **Google-Skript anlegen:** „Code kopieren“, dann „Apps Script öffnen“. Im Editor den vorhandenen Text löschen, Code einfügen, das Projekt „Studienplaner“ nennen und speichern. Dann **Bereitstellen** → **Neue Bereitstellung** → Typ **Web-App** → **Ausführen als: Ich**, **Wer hat Zugriff: Jeder** → **Bereitstellen**.
   Google warnt „Google hat diese App nicht überprüft“. Das ist normal, weil es dein eigenes Skript ist: **Erweitert** → **Zu Studienplaner (unsicher) wechseln** → **Zulassen**.
2. **Verbinden:** Die angezeigte **Web-App-URL** (endet auf `/exec`) in die App einfügen.
3. **ILIAS-Kalender wählen** (siehe Teil 3, geht auch später in den Einstellungen).
4. **Deine Zeiten prüfen:** Arbeit Mo–Fr 6:00–15:30, Lernzeit werktags 17:00–18:30, am Wochenende 9:30–12:30 und 14:00–16:00, Sport dienstags 18:00–19:30. Alles lässt sich später ändern.

Beim ersten Verbinden legt das Skript in deinem Google-Konto zwei Dinge an:

- die Google-Tabelle **„Studienplaner“** (Blätter: Übersicht, Module, Themen, Aufgaben, Einstellungen)
- den Google Kalender **„Lernplan“** (Lernblöcke und Klausuren)

**Warum „Jeder“?** Damit die App das Skript ohne erneute Anmeldung erreicht. Geschützt ist es trotzdem: Die Adresse kennt nur du, und zusätzlich vereinbart die App beim Verbinden einen geheimen Schlüssel. Ohne ihn liefert das Skript keine Daten.

---

## Teil 3: ILIAS-Termine in den Google Kalender holen

1. In ILIAS deinen Kalender öffnen und **Abonnieren** bzw. **Kalender abonnieren** wählen. Den angezeigten Link kopieren.
2. **calendar.google.com** am PC öffnen. Links neben **Weitere Kalender** auf **+** klicken und dann auf **Per URL**.
3. Link einfügen und auf **Kalender hinzufügen** klicken.
4. In der App unter **Einstellungen** → **Kalender** den neuen Kalender als **ILIAS-Kalender** wählen.

Google aktualisiert abonnierte Kalender nur alle paar Stunden. Neue ILIAS-Termine erscheinen deshalb mit Verzögerung.

**Urlaub:** Trag ihn einfach als Termin mit dem Wort „Urlaub“ im Titel in deinen Google Kalender ein. Die App plant diese Tage dann wie ein Wochenende. Weitere Stichwörter (z. B. „Feiertag“) kannst du in den Einstellungen ergänzen.

---

## Teil 4: App aufs Handy holen

**Am einfachsten:** In der App am PC **Einstellungen** → **Weiteres Gerät verbinden**. Den QR-Code mit der Handykamera scannen. Das Handy ist dann sofort verbunden.

Danach in Chrome auf dem Handy: Menü **⋮** → **App installieren** (oder **Zum Startbildschirm hinzufügen**) → **Installieren**. Die App liegt jetzt mit eigenem Symbol auf dem Startbildschirm, startet ohne Browserleiste und funktioniert auch offline. Änderungen ohne Netz werden übertragen, sobald du wieder online bist.

---

## Mit Claude über deinen Stand sprechen

Alles liegt in deinem Google-Konto. Wenn du in Claude die Verbindungen zu **Google Drive** und **Google Kalender** eingerichtet hast, kannst du zum Beispiel fragen:

- „Lies meine Google-Tabelle *Studienplaner*, Blatt *Übersicht*: Wie stehe ich in Modul 4?“
- „Welche Themen in Modul 3 sind noch offen? Erklär mir das erste davon.“
- „Was steht diese Woche in meinem Kalender *Lernplan*?“
- „Ich habe nächste Woche Urlaub. Schlag mir einen Lernplan für die offenen Themen vor.“

Lernblöcke trägst du am besten in der App ein. Termine, die Claude direkt in den Kalender schreibt, zeigt die App als normalen Termin an, nicht als abhakbaren Lernblock.

---

## Wenn das Google-Skript ein Update braucht

Die App zeigt dann einen Hinweis „Update nötig“. So geht's (die URL bleibt gleich, du musst nichts neu verbinden):

1. Im Hinweis auf **Neuen Code kopieren** tippen.
2. Den Apps-Script-Editor öffnen (script.google.com → Projekt „Studienplaner“), den Code komplett ersetzen und speichern.
3. **Bereitstellen** → **Bereitstellungen verwalten** → Stift-Symbol → bei **Version** „Neue Version“ wählen → **Bereitstellen**.

---

## Probleme lösen

| Meldung | Lösung |
|---|---|
| „Keine Antwort vom Google-Skript“ | Prüfe, ob die URL auf `/exec` endet und bei der Bereitstellung **Wer hat Zugriff: Jeder** eingestellt ist. |
| „Dieses Google-Skript ist schon mit einem anderen Gerät verbunden“ | Auf dem verbundenen Gerät **Einstellungen** → **Weiteres Gerät verbinden** nutzen. Ist kein Gerät mehr verbunden: im Apps-Script-Editor oben die Funktion `verbindungZuruecksetzen` wählen, **Ausführen** klicken und neu verbinden. |
| „Verbindung ungültig“ | Siehe Zeile darüber: Verbindung zurücksetzen und neu verbinden. Deine Daten bleiben erhalten. |
| ILIAS-Termine fehlen | Google aktualisiert abonnierte Kalender nur alle paar Stunden. Später erneut abgleichen. |
| Vorschläge zu ungünstigen Zeiten | **Einstellungen** → **Zeiten** anpassen. |

---

## Was wo gespeichert ist

| Ort | Inhalt |
|---|---|
| Google-Tabelle „Studienplaner“ | Module, Themen mit Status, Aufgaben, Einstellungen und eine lesbare Übersicht. Themen kannst du am PC auch direkt dort ergänzen: Spalte „Modul“ mit der Modulnummer füllen, die ID-Spalten leer lassen. |
| Google Kalender „Lernplan“ | Lernblöcke (✓ = erledigt) und Klausurtermine |
| Dein Handy | ein Zwischenspeicher, damit die App offline startet |
