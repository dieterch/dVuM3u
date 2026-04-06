# dVuM3u

`dVuM3u` is a small Express service that reads a VU+ OpenWebif bouquet and exposes Dispatcharr-compatible M3U and XMLTV feeds. It also includes a server-rendered `/movies` page that scans upcoming EPG entries for likely feature films.

It also provides a minimal HDHomeRun-compatible interface so Plex can use the service directly as a tuner source.

## Start

```bash
cp .env.example .env
docker compose up -d
```

The service listens on port `3005` by default.

Persistent movie finder data is stored in the local `./data` directory by default. In Docker Compose, that directory is mounted into the container as `/data`.

## Endpoints

- `GET /health`
- `GET /channels`
- `GET /m3u`
- `GET /xmltv`
- `GET /discover.json`
- `GET /lineup_status.json`
- `GET /lineup.json`
- `GET /device.xml`
- `GET /stream/:encodedRef`
- `GET /movies`
- `POST /movies`
- `GET /movies.json`
- `GET /logos/:file`

`/m3u` and `/xmltv` accept `?refresh=1` to bypass the in-memory cache.

## Dispatcharr

Use these URLs inside Dispatcharr:

- Playlist: `http://host:3005/m3u`
- EPG: `http://host:3005/xmltv`

The generated M3U uses stable `tvg-id` values that match the XMLTV `<channel id>` values, which keeps Dispatcharr channel-to-EPG mapping consistent.

## Plex / HDHomeRun

`dVuM3u` includes a minimal HDHomeRun emulation layer intended for Plex tuner discovery without SSDP or full tuner state handling.

Relevant endpoints:

- `/discover.json`
- `/lineup_status.json`
- `/lineup.json`
- `/device.xml`
- `/stream/:encodedRef`

The lineup is built from the same bouquet-derived channel list used for `/channels`, `/m3u`, and `/xmltv`, so there is no separate channel configuration.

For Plex, point discovery or manual setup at the dVuM3u base URL, for example:

```text
http://host:3005/discover.json
```

`/lineup.json` exposes stable `GuideNumber` values in bouquet order, and `/stream/:encodedRef` proxies the underlying VU+ MPEG-TS stream from port `8001`.

This is intentionally a minimal HDHomeRun emulation:

- no SSDP broadcast support
- no real tuner reservation or multiplexing

## Filmfinder

Open `http://host:3005/movies` to use the built-in film finder page.

The page renders on the server and provides:

- persistent sender selection sourced from the existing bouquet parsing
- filter inputs for minimum duration and lookahead window
- a simple newspaper-style result layout
- optional sender logos from `./logos`
- best-effort Wikipedia enrichment for matching films

Submitting the form stores the current settings in:

```text
/data/movie-settings.json
```

Inside Docker Compose this maps to:

```text
./data/movie-settings.json
```

The optional JSON view at `/movies.json` uses the persisted settings and returns the current candidate list as JSON.

## Movie Heuristics

The movie finder loads EPG data for the selected channels only and keeps entries that:

- start within the configured lookahead window
- meet the minimum runtime threshold
- survive simple exclusion heuristics

It excludes obvious non-film entries based on terms such as `News`, `Nachricht`, `Wetter`, `Magazin`, `Journal`, `Doku`, `Dokumentation`, `Serie`, `Show`, `Sport`, `Kinder`, `Soap`, `Talk`, and `Reality`.

It boosts entries that look more film-like through terms such as `Film`, `Spielfilm`, `Thriller`, `Drama`, `Komödie`, `Krimi`, `Abenteuerfilm`, `Liebesfilm`, `Science-Fiction`, and `Horrorfilm`.

The result is intentionally heuristic: candidates are sorted by start time, and false positives or missed films are still possible.

## Wikipedia Enrichment

For each candidate, the service tries to search German Wikipedia and, if a likely match is found, adds:

- Wikipedia link
- production year when it can be extracted
- short description
- a simple confidence label

Wikipedia lookups are best effort and cached in `/data/wikipedia-cache.json`. If Wikipedia is unavailable or no match is found, the movie candidate is still shown.

## Logos

Place logo files in the local `./logos` directory using the generated channel id as the filename:

```text
<channelId>.png
```

Example:

```text
1_0_19_283D_3FB_1_C00000_0_0_0_.png
```

The service serves logos at `/logos/<channelId>.png` and includes those URLs in both M3U and XMLTV when the file exists.

## Notes

- Streams point directly at the VU+ receiver on port `8001`.
- No authentication or database is used.
- The movie finder uses German Wikipedia as an optional external metadata source.
- `PUBLIC_BASE_URL` should be set in `.env` to the URL Plex or other clients should use, so HDHomeRun discovery and lineup URLs do not point to `localhost`.

## Configuration

Useful environment variables:

- `PORT` defaults to `3005`
- `VU_IP` points to the VU+ receiver
- `BOUQUET_NAME` sets the displayed bouquet label
- `BOUQUET_REF` selects the OpenWebif bouquet reference
- `LOGO_DIR` defaults to `/app/logos`
- `DATA_DIR` defaults to `./data` for local runs and can be set to `/data` in containers
- `MOVIE_SETTINGS_FILE` defaults to `<DATA_DIR>/movie-settings.json`
- `MOVIE_LOOKAHEAD_HOURS` defaults to `48`
- `MOVIE_MIN_DURATION_MINUTES` defaults to `80`
- `WIKIPEDIA_CACHE_TTL_MS` defaults to `86400000`
- `PUBLIC_BASE_URL` forces a fixed public base URL for generated links
- `HDHR_FRIENDLY_NAME` defaults to `dVuM3u HDHomeRun`
- `HDHR_DEVICE_ID` defaults to `12345678`
