# dVuM3u HDHomeRun Erweiterung

## Ziel

Erweitere dVuM3u um eine minimale HDHomeRun-Emulation, sodass Plex direkt darauf zugreifen kann und Dispatcharr entfällt.

Bestehende Endpunkte bleiben unverändert:
- /health
- /channels
- /m3u
- /xmltv
- /logos
- /movies

Neue Endpunkte:
- /discover.json
- /lineup_status.json
- /lineup.json
- /device.xml
- /stream/:encodedRef

---

## discover.json

Antwort:

{
  "FriendlyName": "dVuM3u HDHomeRun",
  "Manufacturer": "Custom",
  "ModelNumber": "HDTC-2US",
  "FirmwareName": "hdhomerun_atsc",
  "FirmwareVersion": "20260406",
  "DeviceID": "12345678",
  "DeviceAuth": "dVuM3u",
  "BaseURL": "http://HOST:PORT",
  "LineupURL": "http://HOST:PORT/lineup.json"
}

---

## lineup_status.json

{
  "ScanInProgress": 0,
  "ScanPossible": 1,
  "Source": "Cable",
  "SourceList": ["Cable"],
  "Progress": 100,
  "Found": <channelCount>
}

---

## lineup.json

[
  {
    "GuideNumber": "1",
    "GuideName": "Das Erste HD",
    "URL": "http://HOST:PORT/stream/<encodedRef>"
  }
]

- Reihenfolge = Bouquet
- GuideNumber = stabil (1..N)

---

## device.xml

Einfache XML-Struktur:

<root>
  <device>
    <friendlyName>dVuM3u HDHomeRun</friendlyName>
    <manufacturer>Custom</manufacturer>
    <modelNumber>HDTC-2US</modelNumber>
    <serialNumber>12345678</serialNumber>
  </device>
</root>

---

## stream endpoint

GET /stream/:encodedRef

- decode serviceRef
- redirect zu:
  http://VUIP:8001/<serviceRef>

Statuscode: 302 oder 307

---

## ENV Variablen

PUBLIC_BASE_URL
HDHR_FRIENDLY_NAME
HDHR_DEVICE_ID

---

## Architektur

- gleiche Channelbasis verwenden wie /m3u und /xmltv
- keine doppelte Logik
- kein SSDP notwendig
- kein echtes Tuner-Handling

---

## Erfolg

- Plex erkennt Service
- Kanäle sichtbar
- Streams starten