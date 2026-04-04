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
  logoDir: process.env.LOGO_DIR || '/app/logos',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  timeZone: process.env.TZ || 'Europe/Vienna',
  requestTimeoutMs: parseIntEnv('REQUEST_TIMEOUT_MS', 10000),
  cacheTtl: {
    channelsMs: parseIntEnv('CHANNELS_CACHE_TTL_MS', 60000),
    m3uMs: parseIntEnv('M3U_CACHE_TTL_MS', 60000),
    xmltvMs: parseIntEnv('XMLTV_CACHE_TTL_MS', 300000),
  },
};
