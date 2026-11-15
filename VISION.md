# Studienplaner – Vision & Konzept

*Stand: 15.11.2026 · Status: Version 1.0 gebaut (Stufe 1 und 2), Einrichtung siehe [ANLEITUNG.md](ANLEITUNG.md)*

---

## 1. Ausgangslage

- **Studium:** berufsbegleitend Master of Laws (LL.M.) + Steuerberater
- **Beruf:** Mo–Fr, 6:00–15:30 Uhr, dazu normale Urlaubstage
- **Fortschritt:** Module 1, 2 und 6 abgeschlossen, Module 3, 4 und 5 offen (alle mit Klausur)
- **Heutige Organisation:** Google Kalender + Plakate in der Wohnung
- **Termine:** in ILIAS, mit Kalenderexport (iCal)
- **Lernzeit:** werktags realistisch 1–2 Stunden, am Wochenende mehr
- **Sport:** bevorzugt dienstags, flexibel
- **Gerät:** Android-Handy, PC-Zugriff später

### Die zwei Kernprobleme

1. **Zu spät anfangen**
2. **Zu wenig Überblick über die vielen Themen**

Jede Funktion der App muss auf mindestens eins dieser beiden Probleme einzahlen.

---

## 2. Leitidee

> **Ein Blick aufs Handy, und ich weiß, wo ich stehe, was als Nächstes dran ist und ob ich rechtzeitig fertig werde.**

Die App ist das digitale Gegenstück zu den Plakaten an der Wand. Sie zeigt die vollständige Themenübersicht und den Zeitplan, ist immer dabei, immer aktuell und mit dem Google Kalender abgeglichen.

### Grundsätze

- **Du planst, die App hilft.** Sie macht Vorschläge, plant aber nicht von selbst: Ohne deine Bestätigung landet nichts im Kalender.
- **Deine Daten bleiben in deinem Google-Konto.** Termine stehen im Google Kalender, Themen, Fortschritt und Aufgaben in einer Datei in deinem Google Drive.
- **Kein KI-Chat in der App.** Gespräche führst du in Claude. Claude greift dafür auf dieselben Daten zu.
- **Handy zuerst** (Android), PC später.
- **Nur für dich.** Es gibt keine weiteren Nutzer, Lerngruppen oder Teamfunktionen.

### Design

- **Minimalistisch und clean:** ruhige Flächen, viel Weißraum. Farbe setzt die App nur für Module und Status ein.
- **Visuell:** Fortschritt, Zeit und Belastung werden gezeigt statt beschrieben, mit Ringen, Balken, Wochenraster und Zeitstrahl.

---

## 3. Funktionen

### 3.1 Dashboard „Heute“

- Heutige Lernblöcke, Arbeitszeit und Termine als Tagesablauf
- **Frühwarnung** gegen zu spätes Anfangen, z. B.:
  *„Modul 3 wird knapp: 14 offene Themen, noch 9 Lernwochen bis zur Klausurphase.“*
- **Klausur-Ringe:** Tage bis zur Klausur und Fortschritt pro Modul
- **Lernzeit der nächsten 7 Tage** als Balkendiagramm
- **Fällige Aufgaben**

### 3.2 Termine & Google-Kalender-Sync

- **ILIAS → Google Kalender:** Die ILIAS-Termine erscheinen automatisch in einem eigenen Kalender „Studium – ILIAS“.
- **Lernblöcke und Klausuren → Google Kalender:** Was du in der App planst, landet automatisch in einem eigenen Kalender „Lernplan“.
- **Abgleich in beide Richtungen:** Wenn du einen Lernblock im Google Kalender verschiebst, sieht die App das.
- **Feste Zeiten werden berücksichtigt:** Arbeitszeit (Mo–Fr 6:00–15:30) und der bevorzugte Sporttag (dienstags, flexibel).
- **Urlaub wird automatisch erkannt:** Trägst du „Urlaub“ in den Google Kalender ein, plant die App diesen Tag wie ein Wochenende.

### 3.3 Module, Themen & Aufgaben (das „digitale Plakat“)

- **Module selbst anlegen:** mit Nummer, Name, Klausurdatum und Farbe. Das gilt für die Module 3, 4 und 5 und für alle späteren.
- **Themen selbst anlegen:** pro Modul eine Gliederung, z. B. aus dem Inhaltsverzeichnis des Skripts
- **Status pro Thema:** offen → gelernt → wiederholt → sitzt
- **Aufgaben pro Modul** mit Fälligkeitsdatum (z. B. „Übungsklausur 1 bearbeiten“). Sie werden in der App verwaltet, es gibt keine Google-Tasks-Anbindung.
- Fortschrittsbalken pro Modul
- Abgeschlossene Module (1, 2, 6) als Archiv

### 3.4 Lernplanung mit Unterstützung

- **Wochenraster der nächsten 7 Tage:** Arbeit, Termine, Lernblöcke und freie Zeitfenster auf einen Blick
- **Freies Zeitfenster antippen:** Modul und Thema wählen, und der Lernblock wird eingetragen.
- **„Plan vorschlagen“:** Die App füllt freie Zeitfenster mit offenen Themen und Wiederholungen. Du prüfst die Vorschläge und übernimmst sie.
- **Rückwärtsrechner:** Er teilt die offenen Themen durch die Lernwochen bis zur Klausurphase und zeigt dir, welches Tempo nötig ist (im Plan / knapp / hinterher).
- **Klausurphase:** Die letzten 3 Wochen vor einer Klausur sind für Wiederholung und Übungsklausuren reserviert.
- **Lernblock abhaken:** Das Thema rückt automatisch eine Stufe weiter.
- **Zeitstrahl:** Lern- und Klausurphasen aller Module bis zur letzten Klausur

### 3.5 Zusammenspiel mit Claude

Alle Daten liegen in deinem Google-Konto. Deshalb kann Claude über die Verbindungen zu Google Kalender und Google Drive darauf zugreifen. Du kannst in Claude zum Beispiel fragen:

- „Wie stehe ich in Modul 4? Was fehlt noch?“
- „Ich habe nächste Woche Urlaub, schlag mir einen Lernplan vor.“ Claude kann die Lernblöcke dann direkt in den Kalender eintragen.
- „Erklär mir das Thema, das morgen in meinem Lernplan steht.“

---

## 4. Bewusst nicht enthalten

- Google-Tasks-Anbindung (Aufgaben bleiben in der App)
- Fokus-Timer und Zeiterfassung
- KI-Chat in der App (läuft über Claude)
- Poster-Export (die Übersicht in der App reicht)
- Mehrere Nutzer und Lerngruppen
- Eine App aus dem Play Store (zumindest vorerst)

---

## 5. Technik (in einfachen Worten)

Du musst nicht programmieren. Claude baut die App, du testest sie und gibst Feedback.

- **Web-App, die sich wie eine echte App installieren lässt (PWA):** Du öffnest einen Link in Chrome auf deinem Android-Handy und tippst auf „App installieren“. Die App liegt dann mit eigenem Symbol auf dem Startbildschirm. Die PC-Version gibt es damit automatisch dazu.
- **Kostenlos veröffentlicht über GitHub Pages.**
- **Ein kleines Google-Skript in deinem eigenen Google-Konto** verbindet die App mit Kalender und Tabelle. Es gibt keinen fremden Server und keine Anmeldung bei jedem Start. Ein geheimer Schlüssel schützt den Zugriff.
- **Offline-fähig:** Die App startet ohne Netz. Änderungen werden übertragen, sobald du wieder online bist.
- **Einmalige Einrichtung (ca. 30 Minuten):** Die App führt dich durch, Details stehen in [ANLEITUNG.md](ANLEITUNG.md).

---

## 6. Ausbaustufen

| Stufe | Ziel | Inhalt |
|---|---|---|
| **1 – Überblick** | Nie wieder den Überblick verlieren | Module, Themen & Aufgaben anlegen, Status pro Thema, Dashboard mit Klausur-Ringen & Frühwarnung, ILIAS-Termine, Lernblöcke planen → Google Kalender |
| **2 – Planungshilfe** | Rechtzeitig und realistisch planen | Wochenraster mit freien Zeitfenstern, „Plan vorschlagen“, Rückwärtsrechner, Zeitstrahl, Urlaubserkennung |
| **3 – Komfort** | Überall und bequem | PC-Ansicht, Push-Erinnerungen, Steuerberaterprüfung als Langzeitplanung (ab 2027) |

---

## 7. Geklärt

- **Gerät:** Android
- **Module, Themen und Aufgaben** legst du selbst in der App an.
- **Lernzeit:** werktags 1–2 Stunden, am Wochenende mehr
- **Steuerberaterprüfung:** wird später ergänzt, sobald die Eckdaten 2027 feststehen.
- **Plakate:** Die Übersicht in der App reicht, ein Druck-Export ist nicht nötig.
- **Urlaub:** Er wird automatisch erkannt, sobald er im Google Kalender steht.
- **Google Tasks:** entfällt
- **Design:** minimalistisch, clean, visuell

## 8. Stand und nächste Schritte

- [x] Klickbaren Entwurf abgestimmt
- [x] Version 1.0 gebaut: Stufe 1 (Überblick) und Stufe 2 (Planungshilfe) komplett, dazu Offline-Modus und Verbindung weiterer Geräte per QR-Code
- [ ] App online stellen und einrichten (siehe [ANLEITUNG.md](ANLEITUNG.md))
- [ ] Ein paar Wochen nutzen und Feedback sammeln
- [ ] Stufe 3: Push-Erinnerungen, Steuerberaterprüfung (ab 2027)
