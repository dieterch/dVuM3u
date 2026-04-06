import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function toPositiveInteger(value, fallback, { min = 1, max = 24 * 14 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeSelectedChannels(value) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      values
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
}

export function buildDefaultMovieSettings(config) {
  return {
    selectedChannels: [],
    minimumDurationMinutes: config.movieDefaults.minDurationMinutes,
    lookaheadHours: config.movieDefaults.lookaheadHours,
  };
}

export function normalizeMovieSettings(input, defaults, availableChannelIds = null) {
  const selectedChannels = normalizeSelectedChannels(input?.selectedChannels);
  const allowedChannels = availableChannelIds
    ? new Set(availableChannelIds)
    : null;

  return {
    selectedChannels: allowedChannels
      ? selectedChannels.filter((channelId) => allowedChannels.has(channelId))
      : selectedChannels,
    minimumDurationMinutes: toPositiveInteger(
      input?.minimumDurationMinutes,
      defaults.minimumDurationMinutes,
      { min: 30, max: 360 },
    ),
    lookaheadHours: toPositiveInteger(input?.lookaheadHours, defaults.lookaheadHours, {
      min: 1,
      max: 24 * 14,
    }),
  };
}

export class MovieSettingsStore {
  constructor(config) {
    this.dataDir = config.dataDir;
    this.settingsFile = config.movieSettingsFile;
    this.defaults = buildDefaultMovieSettings(config);
  }

  async load(availableChannelIds = null) {
    try {
      const raw = await readFile(this.settingsFile, 'utf8');
      return normalizeMovieSettings(JSON.parse(raw), this.defaults, availableChannelIds);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[dVuM3u] Failed to read movie settings', { error: error.message });
      }
      return normalizeMovieSettings({}, this.defaults, availableChannelIds);
    }
  }

  async save(input, availableChannelIds = null) {
    const settings = normalizeMovieSettings(input, this.defaults, availableChannelIds);
    await mkdir(path.dirname(this.settingsFile), { recursive: true });
    await writeFile(this.settingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    return settings;
  }

  async ensureDataDir() {
    await mkdir(this.dataDir, { recursive: true });
  }
}
