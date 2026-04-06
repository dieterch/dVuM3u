# Ergänzungsspec für Codex: Filmfinder-Webseite mit persistenter Senderauswahl

## Ziel

Erweitere das bestehende Projekt **dVuM3u** um eine kleine Weboberfläche im Zeitungsstil, mit der kommende Spielfilme auf ausgewählten Sendern angezeigt werden können, ohne Plex/NAS starten zu müssen.

Die neue Funktion soll:

- eine Webseite bereitstellen
- eine **Mehrfachauswahl von Sendern** erlauben
- die Auswahl **persistent speichern**
- nach Klick auf einen Button die Filmkandidaten anzeigen
- EPG-Daten der ausgewählten Sender auswerten
- Kandidaten anhand von Regeln als mögliche Spielfilme erkennen
- optional Wikipedia-Metadaten ergänzen

---

## Funktionsidee

Der Nutzer öffnet eine neue Seite, zum Beispiel:

```text
/movies
```

Dort sieht er:

- eine Mehrfachauswahl der verfügbaren Sender
- optional zusätzliche Filter
- einen Button wie:
  - `Filme anzeigen`
  - oder `Suche starten`

Nach Klick auf den Button werden die kommenden Filmkandidaten für die ausgewählten Sender dargestellt.

Die Senderauswahl soll nach einem Reload erhalten bleiben.

---

## UI-Anforderungen

## Neue Route

### `GET /movies`

Liefert eine HTML-Seite mit:

- einfacher, statischer oder serverseitig gerenderter Oberfläche
- Zeitungsstil / Magazin-Stil
- Fokus auf Lesbarkeit statt komplexem Frontend

### `GET /movies/results`

Optional möglich, wenn die Ergebnisse getrennt geladen werden sollen.

### `GET /movies/settings`

Optionaler JSON-Endpunkt für persistente Auswahl.

### `POST /movies/settings`

Speichert die persistente Senderauswahl.

### `GET /movies.json`

Liefert die Filmkandidaten als JSON für Debugging oder spätere Erweiterungen.

---

## Senderauswahl

## Anforderungen

Die Senderauswahl soll als **Mehrfachauswahl** umgesetzt werden.

Mögliche UI-Varianten:

- HTML `<select multiple>`
- Dropdown mit Checkboxen
- einfache Liste mit Checkboxen

Für Version 1 ist eine einfache, robuste Lösung wichtiger als perfekte Optik.

### Empfehlung

Verwende:

- serverseitig gerenderte HTML-Seite
- einfache Mehrfachauswahl
- Submit-Button

---

## Persistenz der Auswahl

Die Auswahl soll dauerhaft erhalten bleiben.

### Akzeptierte Varianten

1. JSON-Datei auf dem Dateisystem
2. einfacher lokaler Speicher im Container mit gemountetem Volume

### Empfehlung

Speichere die Auswahl in einer Datei wie:

```text
/data/movie-settings.json
```

Inhalt z. B.:

```json
{
  "selectedChannels": [
    "1_0_19_283D_3FB_1_C00000_0_0_0_",
    "1_0_19_2B66_3F3_1_C00000_0_0_0_"
  ],
  "minimumDurationMinutes": 80,
  "lookaheadHours": 48
}
```

### Docker-Anforderung

Das Verzeichnis `/data` muss per Volume gemountet werden, damit die Auswahl persistent bleibt.

---

## Datenquelle für Senderliste

Die auswählbaren Sender sollen **nicht hartcodiert** sein.

Stattdessen:

- Bouquet aus dem bestehenden System laden
- verfügbare Sender aus `/channels` oder interner Bouquet-Logik ableiten

Jeder auswählbare Sender soll mindestens haben:

- Anzeigename
- channelId
- serviceRef

---

## Filmfinder-Logik

## Eingabe

Die Filmfindung soll nur für die **ausgewählten Sender** laufen.

## Vorfilter

Ein EPG-Eintrag wird zunächst als Kandidat betrachtet, wenn:

- der Sender ausgewählt ist
- die Dauer mindestens konfigurierbar ist, Standard z. B. `80` Minuten
- der Start innerhalb eines konfigurierbaren Zeitfensters liegt, Standard z. B. `48` Stunden

## Ausschluss-Heuristiken

Die erste Version soll möglichst ohne KI auskommen und heuristisch filtern.

Beispiele für Ausschluss:

- Nachricht
- News
- Wetter
- Magazin
- Journal
- Report
- Doku
- Dokumentation
- Serie
- Talk
- Show
- Sport
- Kinder
- Zeichentrick
- Gericht
- Soap
- Reality

Diese Prüfung kann auf Titel, Untertitel und Beschreibung laufen.

## Positiv-Heuristiken

Ein EPG-Eintrag wird eher als Filmkandidat bewertet, wenn:

- Dauer >= Mindestdauer
- Titel wirkt wie Einzeltitel
- Beschreibung enthält Begriffe wie:
  - Film
  - Spielfilm
  - Thriller
  - Drama
  - Komödie
  - Krimi
  - Abenteuerfilm
  - Liebesfilm
  - Science-Fiction
  - Horrorfilm

Das Ergebnis soll zunächst eine Liste von **Kandidaten** sein, nicht zwingend perfekte Wahrheit.

---

## Wikipedia-Anreicherung

Optional, aber in diese Erweiterung bereits vorbereiten oder direkt einbauen.

Für Kandidaten kann zusätzlich gesucht werden:

- Titel
- optional Titel + Jahr
- optional Titel + Begriff `film`

Bei Treffer sollen, wenn verfügbar, ergänzt werden:

- Wikipedia-Titel
- Produktionsjahr
- Wikipedia-Link
- Kurzbeschreibung
- Match-Sicherheit

### Wichtig

Wikipedia-Anreicherung soll **best effort** sein:

- keine harte Abhängigkeit
- bei Fehlern weiterarbeiten
- Kandidaten trotzdem anzeigen

### Caching

Wikipedia-Treffer sollten gecacht werden, damit nicht bei jedem Klick alles neu gesucht wird.

Empfehlung:

- einfacher JSON-Cache in `/data`
- oder In-Memory-Cache mit TTL

---

## Ergebnisdarstellung

Die Ergebnisseite soll im **Zeitungsstil** erscheinen.

## Layout-Idee

- große Überschrift
- Datum / Zeitraum
- Spalten oder Karten
- Abschnitte wie:
  - Heute
  - Morgen
  - Später

Jeder Filmblock soll enthalten:

- Titel
- Startzeit
- Endzeit oder Dauer
- Sendername
- eventuell Produktionsjahr
- eventuell Kurzbeschreibung
- eventuell Wikipedia-Link
- optional Senderlogo

## Sortierung

- primär nach Startzeit aufsteigend
- sekundär nach Sendername

## Leere Ergebnisse

Wenn keine Kandidaten gefunden werden:

- klare freundliche Meldung anzeigen
- Senderauswahl trotzdem sichtbar lassen

---

## API / Backend-Erweiterungen

## Neue Module

Empfohlene neue Dateien:

```text
lib/
  movie-settings.js
  movie-finder.js
  wikipedia.js
  html.js
```

### `lib/movie-settings.js`

Aufgaben:

- Laden der persistenten Einstellungen
- Speichern der persistenten Einstellungen
- Defaults anwenden

### `lib/movie-finder.js`

Aufgaben:

- EPG-Daten für ausgewählte Sender laden
- Vorfilter anwenden
- Kandidaten sortieren
- optionale Wikipedia-Anreicherung aufrufen

### `lib/wikipedia.js`

Aufgaben:

- Wikipedia-Suche
- Zusammenfassung holen
- Produktionsjahr heuristisch extrahieren
- Link und Match-Sicherheit liefern
- Caching

### `lib/html.js`

Aufgaben:

- HTML für `/movies` rendern
- Formular und Ergebnisliste erzeugen
- einfache Styles inline oder in kleinem CSS-Block

---

## Endpunkt-Verhalten im Detail

### `GET /movies`

Zeigt die Seite mit:

- Senderauswahl
- bereits gespeicherter Auswahl
- optionalen Filtern
- Button
- optional letzten Ergebnissen oder leerem Bereich

### `POST /movies`

Empfohlenes Verhalten:

- Formulardaten annehmen
- Auswahl persistent speichern
- Suchlauf starten
- HTML-Ergebnisse direkt zurückgeben

Alternativ:

- `POST /movies/settings` speichern
- `GET /movies?run=1` ausführen

Für Version 1 ist `POST /movies` am einfachsten.

### Formularfelder

Mindestens:

- `selectedChannels[]`
- `minimumDurationMinutes`
- `lookaheadHours`

---

## Persistenzdetails

### Defaults

Wenn keine gespeicherte Konfiguration vorhanden ist:

- ausgewählte Sender leer oder sinnvolle Vorauswahl
- `minimumDurationMinutes = 80`
- `lookaheadHours = 48`

### Dateiformat

JSON-Datei, z. B.:

```json
{
  "selectedChannels": [],
  "minimumDurationMinutes": 80,
  "lookaheadHours": 48
}
```

### Fehlerbehandlung

Wenn die Datei kaputt oder unlesbar ist:

- Defaults verwenden
- Warnung loggen
- Anwendung nicht abbrechen

---

## Docker-Erweiterungen

## compose.yaml erweitern

Zusätzlich zum Logo-Volume soll ein Daten-Volume gemountet werden:

```yaml
volumes:
  - ./logos:/app/logos
  - ./data:/data
```

### Neue Umgebungsvariablen

- `DATA_DIR=/data`
- `MOVIE_SETTINGS_FILE=/data/movie-settings.json`
- `MOVIE_LOOKAHEAD_HOURS=48`
- `MOVIE_MIN_DURATION_MINUTES=80`

---

## README-Erweiterung

Dokumentiere:

- neue Route `/movies`
- dass Senderauswahl persistent gespeichert wird
- wo Logos und Einstellungen liegen
- wie Filmkandidaten erkannt werden
- dass Wikipedia-Anreicherung best effort ist

---

## Coding Style

- einfache serverseitige HTML-Erzeugung
- kein Frontend-Framework erforderlich
- kein Build-Step
- robust und minimal
- async/await
- defensive Fehlerbehandlung

---

## Nicht Teil von Version 1

Bitte noch nicht einbauen, außer wenn es sehr einfach ist:

- Benutzerkonten
- echte Datenbank
- komplexes Client-JavaScript-Framework
- automatische Hintergrundjobs
- KI-Abhängigkeit
- externe Authentifizierung
- Volltextsuche über alle Inhalte

---

## Nice-to-have, wenn einfach

- Senderlogos in der Ergebnisliste
- Schalter `Wikipedia-Anreicherung aktiv`
- einfache Match-Kennzeichnung:
  - sicher
  - wahrscheinlich
  - unsicher
- `/movies.json` für Debugging
- Button `Auswahl speichern`

---

## Erfolgskriterien

Die Aufgabe ist erfolgreich abgeschlossen, wenn:

1. `/movies` eine HTML-Seite mit Mehrfachauswahl der Bouquet-Sender zeigt
2. die Auswahl persistent in einer Datei gespeichert wird
3. nach Klick auf den Button Filmkandidaten angezeigt werden
4. Filter für Mindestdauer und Zeitfenster funktionieren
5. die Seite ohne Plex/NAS nutzbar ist
6. die Anwendung nach Container-Neustart die Auswahl wieder kennt