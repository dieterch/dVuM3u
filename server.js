import express from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { TTLCache } from './lib/cache.js';
import { config } from './lib/config.js';
import {
  buildDeviceXml,
  buildDiscoverPayload,
  buildLineupPayload,
  buildLineupStatusPayload,
} from './lib/hdhr.js';
import { renderMoviesPage } from './lib/html.js';
import { createLogosMiddleware, resolveLogoName } from './lib/logos.js';
import { findMovieCandidates } from './lib/movie-finder.js';
import { MovieSettingsStore, normalizeMovieSettings } from './lib/movie-settings.js';
import { OpenWebifClient, OpenWebifError } from './lib/openwebif.js';
import {
  buildBaseUrl,
  buildLogoUrl,
  buildM3uGroupTitle,
  buildStreamUrl,
  serviceRefToChannelId,
} from './lib/transform.js';
import { WikipediaClient } from './lib/wikipedia.js';
import { buildXmltv } from './lib/xmltv.js';

const app = express();
const cache = new TTLCache();
const openwebif = new OpenWebifClient(config);
const movieSettings = new MovieSettingsStore(config);
const wikipediaClient = new WikipediaClient(config);

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use('/logos', createLogosMiddleware(config.logoDir));

function logInfo(message, meta = {}) {
  console.info(`[dVuM3u] ${message}`, meta);
}

function logError(message, meta = {}) {
  console.error(`[dVuM3u] ${message}`, meta);
}

function wantsRefresh(req) {
  return req.query.refresh === '1';
}

function getCacheValue(key, refresh) {
  if (refresh) {
    cache.delete(key);
    return null;
  }
  return cache.get(key);
}

async function getChannelRecords(refresh) {
  const cached = getCacheValue('channels', refresh);
  if (cached) {
    return cached;
  }

  const services = await openwebif.fetchBouquetServices();
  const channels = [];

  for (const service of services) {
    const channelId = serviceRefToChannelId(service.serviceRef);
    const logoName = await resolveLogoName(config.logoDir, channelId);
    channels.push({
      name: service.name,
      serviceRef: service.serviceRef,
      channelId,
      logoName,
    });
  }

  cache.set('channels', channels, config.cacheTtl.channelsMs);
  logInfo('Parsed channels', { count: channels.length });
  return channels;
}

function buildChannelPayload(channels, baseUrl) {
  return channels.map((channel) => ({
    name: channel.name,
    serviceRef: channel.serviceRef,
    channelId: channel.channelId,
    logoName: channel.logoName ? `${channel.logoName}.png` : null,
    streamUrl: buildStreamUrl(config.vuIp, channel.serviceRef),
    logoUrl: channel.logoName ? buildLogoUrl(baseUrl, channel.logoName) : null,
  }));
}

async function getAvailableChannels(req) {
  const refresh = wantsRefresh(req);
  const baseUrl = buildBaseUrl(req, config.publicBaseUrl);
  const channels = await getChannelRecords(refresh);
  return buildChannelPayload(channels, baseUrl);
}

async function getChannels(req) {
  const channels = await getAvailableChannels(req);

  return {
    bouquetName: config.bouquetName,
    sourceIp: config.vuIp,
    count: channels.length,
    channels,
  };
}

async function getM3u(req) {
  const refresh = wantsRefresh(req);
  const baseUrl = buildBaseUrl(req, config.publicBaseUrl);
  const cached = getCacheValue(`m3u:${baseUrl}`, refresh);
  if (cached) {
    return cached;
  }

  const channels = buildChannelPayload(await getChannelRecords(refresh), baseUrl);
  const header = [
    '#EXTM3U',
    `x-tvg-url="${baseUrl}/xmltv"`,
    `url-tvg="${baseUrl}/xmltv"`,
  ].join(' ');
  const lines = [header];
  const groupTitle = buildM3uGroupTitle(config.bouquetName);

  for (const channel of channels) {
    const attributes = [
      `tvg-id="${escapeAttribute(channel.channelId)}"`,
      `tvg-name="${escapeAttribute(channel.name)}"`,
    ];

    if (channel.logoUrl) {
      attributes.push(`tvg-logo="${escapeAttribute(channel.logoUrl)}"`);
    }

    if (groupTitle) {
      attributes.push(`group-title="${escapeAttribute(groupTitle)}"`);
    }

    lines.push(
      `#EXTINF:-1 ${attributes.join(' ')},${channel.name}`,
      channel.streamUrl,
    );
  }

  const body = `${lines.join('\n')}\n`;
  cache.set(`m3u:${baseUrl}`, body, config.cacheTtl.m3uMs);
  return body;
}

async function getXmltv(req) {
  const refresh = wantsRefresh(req);
  const baseUrl = buildBaseUrl(req, config.publicBaseUrl);
  const cached = getCacheValue(`xmltv:${baseUrl}`, refresh);
  if (cached) {
    return cached;
  }

  const channels = buildChannelPayload(await getChannelRecords(refresh), baseUrl);
  const programmesByChannel = new Map();
  let successCount = 0;

  for (const channel of channels) {
    try {
      const programmes = await openwebif.fetchEpgForService(channel.serviceRef);
      programmesByChannel.set(channel.channelId, programmes);
      successCount += 1;
    } catch (error) {
      logError('EPG fetch failed for channel', {
        channel: channel.name,
        serviceRef: channel.serviceRef,
        error: error.message,
      });
      programmesByChannel.set(channel.channelId, []);
    }
  }

  if (channels.length > 0 && successCount === 0) {
    throw new OpenWebifError('Failed to fetch EPG for all channels');
  }

  const xml = buildXmltv({
    channels,
    programmesByChannel,
    timeZone: config.timeZone,
  });

  cache.set(`xmltv:${baseUrl}`, xml, config.cacheTtl.xmltvMs);
  logInfo('Generated XMLTV', {
    channels: channels.length,
    programmes: Array.from(programmesByChannel.values()).reduce(
      (total, programmes) => total + programmes.length,
      0,
    ),
  });
  return xml;
}

async function getMoviePageData(req, incomingSettings = null) {
  const channels = await getAvailableChannels(req);
  const channelIds = channels.map((channel) => channel.channelId);
  const persistedSettings = await movieSettings.load(channelIds);
  const settings = incomingSettings
    ? normalizeMovieSettings(incomingSettings, movieSettings.defaults, channelIds)
    : persistedSettings;

  return {
    channels,
    settings,
  };
}

async function getHdhrData(req) {
  const baseUrl = buildBaseUrl(req, config.publicBaseUrl);
  const channels = await getAvailableChannels(req);

  return {
    baseUrl,
    channels,
  };
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sendUpstreamError(res, error) {
  const statusCode = error instanceof OpenWebifError ? 502 : 500;
  res.status(statusCode).json({
    error: error.message,
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/channels', async (req, res) => {
  logInfo('Request /channels');

  try {
    const payload = await getChannels(req);
    res.json(payload);
  } catch (error) {
    logError('Failed /channels request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/m3u', async (req, res) => {
  logInfo('Request /m3u');

  try {
    const payload = await getM3u(req);
    res.type('application/x-mpegURL').send(payload);
  } catch (error) {
    logError('Failed /m3u request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/xmltv', async (req, res) => {
  logInfo('Request /xmltv');

  try {
    const payload = await getXmltv(req);
    res.type('application/xml').send(payload);
  } catch (error) {
    logError('Failed /xmltv request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/discover.json', async (req, res) => {
  logInfo('Request /discover.json');

  try {
    const { baseUrl } = await getHdhrData(req);
    res.json(buildDiscoverPayload({ baseUrl, config }));
  } catch (error) {
    logError('Failed /discover.json request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/lineup_status.json', async (req, res) => {
  logInfo('Request /lineup_status.json');

  try {
    const { channels } = await getHdhrData(req);
    res.json(buildLineupStatusPayload(channels.length));
  } catch (error) {
    logError('Failed /lineup_status.json request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/lineup.json', async (req, res) => {
  logInfo('Request /lineup.json');

  try {
    const { baseUrl, channels } = await getHdhrData(req);
    res.json(buildLineupPayload(channels, baseUrl));
  } catch (error) {
    logError('Failed /lineup.json request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/device.xml', (req, res) => {
  logInfo('Request /device.xml');

  try {
    res.type('application/xml').send(buildDeviceXml({ config }));
  } catch (error) {
    logError('Failed /device.xml request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/stream/:encodedRef', async (req, res) => {
  logInfo('Request /stream/:encodedRef');

  try {
    const serviceRef = decodeURIComponent(req.params.encodedRef || '').trim();
    if (!serviceRef) {
      res.status(400).json({ error: 'Missing service reference' });
      return;
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const upstream = await fetch(buildStreamUrl(config.vuIp, serviceRef), {
      signal: controller.signal,
      headers: {
        accept: '*/*',
      },
    });

    if (!upstream.ok || !upstream.body) {
      throw new OpenWebifError(`Upstream stream request failed with status ${upstream.status}`);
    }

    res.status(200);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'video/mp2t');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('connection', 'keep-alive');

    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    if (error.name === 'AbortError') {
      logInfo('Client closed /stream connection');
      return;
    }

    logError('Failed /stream/:encodedRef request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/movies', async (req, res) => {
  logInfo('Request /movies');

  try {
    const { channels, settings } = await getMoviePageData(req);
    res.type('html').send(
      renderMoviesPage({
        channels,
        settings,
        timeZone: config.timeZone,
      }),
    );
  } catch (error) {
    logError('Failed /movies request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.post('/movies', async (req, res) => {
  logInfo('Request POST /movies');

  try {
    const { channels } = await getMoviePageData(req);
    const channelIds = channels.map((channel) => channel.channelId);
    const settings = await movieSettings.save(
      {
        selectedChannels: req.body.selectedChannels,
        minimumDurationMinutes: req.body.minimumDurationMinutes,
        lookaheadHours: req.body.lookaheadHours,
      },
      channelIds,
    );
    const results = await findMovieCandidates({
      channels,
      settings,
      openwebif,
      wikipediaClient,
    });

    res.type('html').send(
      renderMoviesPage({
        channels,
        settings,
        results,
        timeZone: config.timeZone,
      }),
    );
  } catch (error) {
    logError('Failed POST /movies request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/movies.json', async (req, res) => {
  logInfo('Request /movies.json');

  try {
    const { channels, settings } = await getMoviePageData(req);
    const results = await findMovieCandidates({
      channels,
      settings,
      openwebif,
      wikipediaClient,
    });

    res.json({
      settings,
      stats: results.stats,
      channels: results.selectedChannels.map((channel) => ({
        channelId: channel.channelId,
        name: channel.name,
        serviceRef: channel.serviceRef,
      })),
      movies: results.candidates,
    });
  } catch (error) {
    logError('Failed /movies.json request', { error: error.message });
    sendUpstreamError(res, error);
  }
});

app.get('/logos/:file', (_req, res) => {
  res.status(404).json({ error: 'Logo not found' });
});

movieSettings
  .ensureDataDir()
  .catch((error) => logError('Failed to initialize data directory', { error: error.message }))
  .finally(() => {
    app.listen(config.port, () => {
      logInfo('Service started', {
        port: config.port,
        vuIp: config.vuIp,
        bouquetName: config.bouquetName,
      });
    });
  });
