import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripTags(value) {
  return String(value || '').replaceAll(/<[^>]*>/g, ' ').replaceAll(/\s+/g, ' ').trim();
}

function extractYear(...values) {
  for (const value of values) {
    const match = String(value || '').match(/\b(19\d{2}|20\d{2})\b/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function confidenceLabel(score) {
  if (score >= 0.9) {
    return 'hoch';
  }
  if (score >= 0.7) {
    return 'mittel';
  }
  return 'niedrig';
}

export class WikipediaClient {
  constructor(config) {
    this.cacheFile = path.join(config.dataDir, 'wikipedia-cache.json');
    this.ttlMs = config.wikipediaCacheTtlMs;
    this.cache = null;
    this.pendingWrite = null;
  }

  async lookupMovie(title) {
    const key = normalizeKey(title);
    if (!key) {
      return null;
    }

    const cache = await this.#loadCache();
    const cached = cache[key];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.#fetchMovie(title);
    cache[key] = {
      expiresAt: Date.now() + this.ttlMs,
      value,
    };
    await this.#persistCache();
    return value;
  }

  async #fetchMovie(title) {
    const searchUrl = new URL('https://de.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', `${title} film`);
    searchUrl.searchParams.set('srlimit', '5');
    searchUrl.searchParams.set('srprop', 'snippet');
    searchUrl.searchParams.set('utf8', '1');

    const searchResponse = await fetch(searchUrl, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Wikipedia search failed with status ${searchResponse.status}`);
    }

    const searchPayload = await searchResponse.json();
    const results = Array.isArray(searchPayload?.query?.search)
      ? searchPayload.query.search
      : [];
    const best = this.#selectBestMatch(title, results);
    if (!best) {
      return null;
    }

    const summaryUrl = `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(best.title)}`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        accept: 'application/json',
      },
    });
    if (!summaryResponse.ok) {
      return null;
    }

    const summary = await summaryResponse.json();
    const description = summary.description || '';
    const extract = summary.extract || '';
    const wikipediaUrl =
      summary?.content_urls?.desktop?.page ||
      `https://de.wikipedia.org/wiki/${encodeURIComponent(best.title.replaceAll(' ', '_'))}`;

    return {
      title: summary.title || best.title,
      url: wikipediaUrl,
      description: extract || description,
      year: extractYear(description, extract, best.snippet),
      posterUrl: summary?.thumbnail?.source || null,
      confidence: confidenceLabel(best.score),
      score: best.score,
    };
  }

  #selectBestMatch(title, results) {
    const wanted = normalizeKey(title);
    const scored = results
      .map((result) => {
        const candidate = normalizeKey(result?.title);
        const snippet = stripTags(result?.snippet);
        let score = 0;

        if (!candidate) {
          return null;
        }
        if (candidate === wanted) {
          score += 0.75;
        } else if (candidate.includes(wanted) || wanted.includes(candidate)) {
          score += 0.55;
        }

        if (/film|spielfilm|drama|thriller|komödie|krimi/i.test(snippet)) {
          score += 0.2;
        }

        if (/begriffskl|disambiguation/i.test(snippet)) {
          score -= 0.5;
        }

        return {
          title: result.title,
          snippet,
          score,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);

    if (!scored.length || scored[0].score < 0.55) {
      return null;
    }

    return scored[0];
  }

  async #loadCache() {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.cacheFile, 'utf8');
      this.cache = JSON.parse(raw);
    } catch (error) {
      this.cache = {};
      if (error.code !== 'ENOENT') {
        console.error('[dVuM3u] Failed to read Wikipedia cache', { error: error.message });
      }
    }

    return this.cache;
  }

  async #persistCache() {
    if (!this.cache) {
      return;
    }

    if (this.pendingWrite) {
      await this.pendingWrite;
    }

    this.pendingWrite = (async () => {
      await mkdir(path.dirname(this.cacheFile), { recursive: true });
      await writeFile(this.cacheFile, `${JSON.stringify(this.cache, null, 2)}\n`, 'utf8');
    })();

    try {
      await this.pendingWrite;
    } finally {
      this.pendingWrite = null;
    }
  }
}
