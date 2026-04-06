import path from 'node:path';

const DEFAULT_BOUQUET_REF =
  '1:7:1:0:0:0:0:0:0:0:FROM BOUQUET "userbouquet.favourites.tv" ORDER BY bouquet';

function parseIntEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

const defaultDataDir = path.resolve(process.cwd(), 'data');

export const config = {
  port: parseIntEnv('PORT', 3005),
  vuIp: process.env.VU_IP || '192.168.15.15',
  bouquetName: process.env.BOUQUET_NAME || 'HD Kabel (TV)',
  bouquetRef: process.env.BOUQUET_REF || DEFAULT_BOUQUET_REF,
  dataDir: process.env.DATA_DIR || defaultDataDir,
  logoDir: process.env.LOGO_DIR || '/app/logos',
  movieSettingsFile:
    process.env.MOVIE_SETTINGS_FILE || path.join(process.env.DATA_DIR || defaultDataDir, 'movie-settings.json'),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  timeZone: process.env.TZ || 'Europe/Vienna',
  requestTimeoutMs: parseIntEnv('REQUEST_TIMEOUT_MS', 10000),
  wikipediaCacheTtlMs: parseIntEnv('WIKIPEDIA_CACHE_TTL_MS', 86400000),
  movieDefaults: {
    lookaheadHours: parseIntEnv('MOVIE_LOOKAHEAD_HOURS', 48),
    minDurationMinutes: parseIntEnv('MOVIE_MIN_DURATION_MINUTES', 80),
  },
  hdhr: {
    friendlyName: process.env.HDHR_FRIENDLY_NAME || 'dVuM3u HDHomeRun',
    manufacturer: process.env.HDHR_MANUFACTURER || 'Custom',
    modelNumber: process.env.HDHR_MODEL_NUMBER || 'HDTC-2US',
    firmwareName: process.env.HDHR_FIRMWARE_NAME || 'hdhomerun_atsc',
    firmwareVersion: process.env.HDHR_FIRMWARE_VERSION || '20260406',
    deviceId: process.env.HDHR_DEVICE_ID || '12345678',
    deviceAuth: process.env.HDHR_DEVICE_AUTH || 'dVuM3u',
  },
  cacheTtl: {
    channelsMs: parseIntEnv('CHANNELS_CACHE_TTL_MS', 60000),
    m3uMs: parseIntEnv('M3U_CACHE_TTL_MS', 60000),
    xmltvMs: parseIntEnv('XMLTV_CACHE_TTL_MS', 300000),
  },
};
