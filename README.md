# dVuM3u

`dVuM3u` is a small Express service that reads a VU+ OpenWebif bouquet and exposes Dispatcharr-compatible M3U and XMLTV feeds.

## Start

```bash
docker compose up -d
```

The service listens on port `3005` by default.

## Endpoints

- `GET /health`
- `GET /channels`
- `GET /m3u`
- `GET /xmltv`
- `GET /logos/:file`

`/m3u` and `/xmltv` accept `?refresh=1` to bypass the in-memory cache.

## Dispatcharr

Use these URLs inside Dispatcharr:

- Playlist: `http://host:3005/m3u`
- EPG: `http://host:3005/xmltv`

The generated M3U uses stable `tvg-id` values that match the XMLTV `<channel id>` values, which keeps Dispatcharr channel-to-EPG mapping consistent.

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
- No authentication, database, or external APIs are used.
- `PUBLIC_BASE_URL` can be set if the service runs behind a reverse proxy and should emit a fixed public logo/XMLTV base URL.
