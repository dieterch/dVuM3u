# Codex Prompt: dVuM3u HDHomeRun Integration

Bitte erweitere das bestehende Node.js Express Projekt dVuM3u um eine minimale HDHomeRun-Emulation.

## Ziel

Plex soll dVuM3u direkt als Tuner verwenden können.
Dispatcharr soll ersetzt werden.

---

## Implementiere folgende Endpunkte:

GET /discover.json  
GET /lineup_status.json  
GET /lineup.json  
GET /device.xml  
GET /stream/:encodedRef  

---

## discover.json

Liefere:

- FriendlyName
- Manufacturer
- ModelNumber
- FirmwareName
- FirmwareVersion
- DeviceID
- DeviceAuth
- BaseURL
- LineupURL

BaseURL soll aus ENV PUBLIC_BASE_URL kommen oder aus Request gebaut werden.

---

## lineup_status.json

Statische Antwort:

- ScanInProgress = 0
- ScanPossible = 1
- Progress = 100
- Found = Anzahl Channels

---

## lineup.json

Nutze bestehende Channel-Logik.

Für jeden Channel:

- GuideNumber (1..N stabil)
- GuideName
- URL = /stream/:encodedRef

---

## stream endpoint

GET /stream/:encodedRef

- decode serviceRef
- redirect auf VU+ Stream:
  http://192.168.15.15:8001/<serviceRef>

---

## device.xml

Erzeuge einfache XML mit:

- friendlyName
- manufacturer
- modelNumber
- serialNumber

---

## Wichtige Anforderungen

- keine neue Channel-Logik
- bestehende Endpunkte bleiben unverändert
- minimal implementieren
- kein SSDP
- kein Proxy notwendig (Redirect reicht)

---

## Code Struktur

Optional:

lib/hdhr.js

---

## Docker

compose.yaml erweitern:

PUBLIC_BASE_URL
HDHR_DEVICE_ID

---

## README

Dokumentiere:

- neue Endpunkte
- Plex Nutzung
- Hinweis: minimale HDHomeRun Emulation

---

## Ziel

Funktionierende minimale Integration, die Plex akzeptiert.