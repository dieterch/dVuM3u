const DEFAULT_BOUQUET_REF =
  '1:7:1:0:0:0:0:0:0:0:FROM BOUQUET "userbouquet.favourites.tv" ORDER BY bouquet';

function parseIntEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  port: parseIntEnv('PORT', 3005),
  vuIp: process.env.VU_IP || '192.168.15.15',
  bouquetName: process.env.BOUQUET_NAME || 'HD Kabel (TV)',
  bouquetRef: process.env.BOUQUET_REF || DEFAULT_BOUQUET_REF,
  dataDir: process.env.DATA_DIR || '/data',
  logoDir: process.env.LOGO_DIR || '/app/logos',
  movieSettingsFile: process.env.MOVIE_SETTINGS_FILE || '/data/movie-settings.json',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  timeZone: process.env.TZ || 'Europe/Vienna',
  requestTimeoutMs: parseIntEnv('REQUEST_TIMEOUT_MS', 10000),
  wikipediaCacheTtlMs: parseIntEnv('WIKIPEDIA_CACHE_TTL_MS', 86400000),
  movieDefaults: {
    lookaheadHours: parseIntEnv('MOVIE_LOOKAHEAD_HOURS', 48),
    minDurationMinutes: parseIntEnv('MOVIE_MIN_DURATION_MINUTES', 80),
  },
  cacheTtl: {
    channelsMs: parseIntEnv('CHANNELS_CACHE_TTL_MS', 60000),
    m3uMs: parseIntEnv('M3U_CACHE_TTL_MS', 60000),
    xmltvMs: parseIntEnv('XMLTV_CACHE_TTL_MS', 300000),
  },
};
