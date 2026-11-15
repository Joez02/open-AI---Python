# Studienplaner – Vision & Konzept

*Stand: 15.11.2026 · Status: Entwurf, wird gemeinsam weiterentwickelt*

---

## 1. Ausgangslage

- **Studium:** berufsbegleitend Master of Laws (LL.M.) + Steuerberater
- **Beruf:** Mo–Fr, 6:00–15:30 Uhr, dazu normale Urlaubstage
- **Fortschritt:** Module 1, 2 und 6 abgeschlossen, Module 3, 4 und 5 offen (alle mit Klausur)
- **Heutige Organisation:** Google Kalender + Plakate in der Wohnung
- **Termine:** in ILIAS, mit Kalenderexport (iCal)
- **Sport:** bevorzugt dienstags, flexibel

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
- **Deine Daten bleiben in deinem Google-Konto.** Termine stehen im Google Kalender, Aufgaben in Google Tasks, Themen und Fortschritt in einer Datei in deinem Google Drive.
- **Kein KI-Chat in der App.** Gespräche führst du in Claude. Claude greift dafür auf dieselben Daten zu.
- **Handy zuerst**, PC später.
- **Nur für dich.** Es gibt keine weiteren Nutzer, Lerngruppen oder Teamfunktionen.

---

## 3. Funktionen

### 3.1 Dashboard „Heute & diese Woche“

- Heutige Lernblöcke und Termine auf einen Blick
- Nächste Termine aus ILIAS, Abgaben und Klausuren
- **Klausur-Countdown** pro Modul (z. B. „Modul 4: noch 47 Tage“)
- **Ampel pro Modul:** im Plan / knapp / hinterher
- **Frühwarnung** gegen zu spätes Anfangen, z. B.:
  *„Für Modul 5 solltest du diese Woche starten, damit du alle Themen bis zur Klausur einmal durcharbeiten und wiederholen kannst.“*

### 3.2 Termine & Google-Sync

- **ILIAS → Google Kalender:** Die ILIAS-Termine erscheinen automatisch in einem eigenen Kalender „Studium – ILIAS“.
- **Lernblöcke → Google Kalender:** Was du in der App planst, landet automatisch in einem eigenen Kalender „Lernplan“.
- **Aufgaben → Google Tasks:** z. B. „Übungsklausur 2 bearbeiten“ mit Fälligkeitsdatum
- **Abgleich in beide Richtungen:** Wenn du einen Lernblock im Google Kalender verschiebst, sieht die App das.
- **Feste Zeiten werden berücksichtigt:** Arbeitszeit (Mo–Fr 6:00–15:30), Urlaubstage, bevorzugter Sporttag

### 3.3 Module & Themenübersicht (das „digitale Plakat“)

- Module 3, 4 und 5 mit Klausurtermin
- Pro Modul eine **Gliederung in Themen und Unterthemen**, z. B. übernommen aus dem Inhaltsverzeichnis des Skripts
- **Status pro Thema:** offen → gelernt → wiederholt → sitzt
- Fortschrittsbalken pro Modul und gesamt
- Notizen und Links (z. B. zum ILIAS-Material) pro Thema
- Abgeschlossene Module (1, 2, 6) als Archiv, falls sie für die Steuerberaterprüfung wieder relevant werden

### 3.4 Lernplanung mit Unterstützung

- **Freie Zeitfenster sichtbar machen:** Feierabend, Wochenende und Urlaub erkennt die App automatisch.
- **Themen in Zeitfenster ziehen:** Du planst selbst, per Fingertipp oder Drag & Drop.
- **Rückwärtsrechner:** Er teilt die offenen Themen durch die verbleibenden Lerntage und zeigt dir, welches Tempo nötig ist.
- **„Plan vorschlagen“:** Die App verteilt die offenen Themen auf freie Zeitfenster. Du passt den Vorschlag an und bestätigst ihn.
- **Wiederholungen** werden automatisch vorgeschlagen (z. B. nach 1, 7 und 21 Tagen).
- **Klausurphase:** Die letzten Wochen vor einer Klausur sind für Wiederholung und Übungsklausuren reserviert.
- **Verpasster Lernblock:** Die App plant nicht heimlich um, sondern fragt nach („Auf Donnerstag 17:00 verschieben?“).

### 3.5 Zusammenspiel mit Claude

Alle Daten liegen in deinem Google-Konto. Deshalb kann Claude über die Verbindungen zu Google Kalender und Google Drive darauf zugreifen. Du kannst in Claude zum Beispiel fragen:

- „Wie stehe ich in Modul 4? Was fehlt noch?“
- „Ich habe nächste Woche Urlaub, schlag mir einen Lernplan vor.“ Claude kann die Lernblöcke dann direkt in den Kalender eintragen.
- „Erklär mir das Thema, das morgen in meinem Lernplan steht.“

*Hinweis:* Derzeit gibt es in Claude keine direkte Verbindung zu Google Tasks. Die App legt deshalb zusätzlich eine Kopie der Aufgaben in der Drive-Datei ab.

---

## 4. Bewusst nicht enthalten

- Fokus-Timer und Zeiterfassung
- KI-Chat in der App (läuft über Claude)
- Mehrere Nutzer und Lerngruppen
- Eine App aus dem App Store (zumindest vorerst)

---

## 5. Technik-Empfehlung (in einfachen Worten)

Du musst nicht programmieren. Claude baut die App, du testest sie und gibst Feedback.

- **Web-App, die sich wie eine echte App installieren lässt (PWA):** Du öffnest einen Link auf dem Handy, tippst auf „Zum Home-Bildschirm“, und die App ist eingerichtet. Das funktioniert auf iPhone und Android ohne App Store. Die PC-Version gibt es damit automatisch dazu.
- **Anmeldung mit deinem Google-Konto.** Es gibt keinen eigenen Server mit Datenbank, der gewartet werden muss.
- **Kostenloses Hosting.**
- **Einmalige Einrichtung (ca. 30 Minuten):** Google-Zugriff freischalten und ILIAS-Kalender verbinden. Claude leitet dich dabei Schritt für Schritt an.

---

## 6. Ausbaustufen

| Stufe | Ziel | Inhalt |
|---|---|---|
| **1 – Überblick** | Nie wieder den Überblick verlieren | Module & Themen erfassen, Klausurtermine, Fortschritt, Dashboard mit Countdown & Frühwarnung, ILIAS-Termine, Lernblöcke manuell planen → Google Kalender, Aufgaben → Google Tasks |
| **2 – Planungshilfe** | Rechtzeitig und realistisch planen | Freie Zeitfenster, Rückwärtsrechner, „Plan vorschlagen“, Wiederholungen, Umplanen verpasster Blöcke, Urlaub |
| **3 – Komfort** | Überall und bequem | PC-Ansicht, Poster-Export (PDF zum Ausdrucken), Push-Erinnerungen, ggf. eigene Claude-Anbindung |

---

## 7. Offene Fragen

- [ ] iPhone oder Android?
- [ ] Wie heißen die Module 3, 4 und 5, und wann sind die Klausuren?
- [ ] Gibt es pro Modul eine Gliederung oder ein Skript-Inhaltsverzeichnis als Themenliste?
- [ ] Wie viel Lernzeit ist realistisch (werktags abends / am Wochenende)?
- [ ] Soll die Steuerberaterprüfung selbst (langfristig) mitgeplant werden?
- [ ] Soll der Poster-Export die Plakate ergänzen, oder soll die App sie ersetzen?
- [ ] Steht der Urlaub bereits im Google Kalender?
- [ ] Reichen Erinnerungen über den Google Kalender, oder sollen eigene Push-Nachrichten kommen?
