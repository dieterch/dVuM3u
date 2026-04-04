import express from 'express';

import { TTLCache } from './lib/cache.js';
import { config } from './lib/config.js';
import { createLogosMiddleware, logoExists } from './lib/logos.js';
import { OpenWebifClient, OpenWebifError } from './lib/openwebif.js';
import {
  buildBaseUrl,
  buildLogoUrl,
  buildM3uGroupTitle,
  buildStreamUrl,
  serviceRefToChannelId,
} from './lib/transform.js';
import { buildXmltv } from './lib/xmltv.js';

const app = express();
const cache = new TTLCache();
const openwebif = new OpenWebifClient(config);

app.disable('x-powered-by');
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
    const hasLogo = await logoExists(config.logoDir, channelId);
    channels.push({
      name: service.name,
      serviceRef: service.serviceRef,
      channelId,
      hasLogo,
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
    streamUrl: buildStreamUrl(config.vuIp, channel.serviceRef),
    logoUrl: channel.hasLogo ? buildLogoUrl(baseUrl, channel.channelId) : null,
  }));
}

async function getChannels(req) {
  const refresh = wantsRefresh(req);
  const baseUrl = buildBaseUrl(req, config.publicBaseUrl);
  const channels = await getChannelRecords(refresh);

  return {
    bouquetName: config.bouquetName,
    sourceIp: config.vuIp,
    count: channels.length,
    channels: buildChannelPayload(channels, baseUrl),
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

app.get('/logos/:file', (_req, res) => {
  res.status(404).json({ error: 'Logo not found' });
});

app.listen(config.port, () => {
  logInfo('Service started', {
    port: config.port,
    vuIp: config.vuIp,
    bouquetName: config.bouquetName,
  });
});
