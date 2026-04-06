const EXCLUSION_TERMS = [
  'news',
  'nachricht',
  'wetter',
  'magazin',
  'journal',
  'report',
  'doku',
  'dokumentation',
  'serie',
  'show',
  'sport',
  'kinder',
  'soap',
  'talk',
  'reality',
  'zeichentrick',
  'gericht',
];

const POSITIVE_TERMS = [
  'film',
  'spielfilm',
  'thriller',
  'drama',
  'komödie',
  'komoedie',
  'krimi',
  'abenteuerfilm',
  'liebesfilm',
  'science-fiction',
  'science fiction',
  'horrorfilm',
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, ' ');
}

function hasAnyTerm(text, terms) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function titleLooksSerial(title) {
  return /staffel|episode|folge|s\d{1,2}e\d{1,2}|teil\s+\d+/i.test(String(title || ''));
}

function buildCandidateScore(event, minimumDurationMinutes) {
  const title = String(event.title || '').trim();
  const description = String(event.description || '').trim();
  const haystack = normalizeText(`${title} ${description}`);
  const durationMinutes = Math.round(Number(event.duration || 0) / 60);
  const hasPositiveTerm = hasAnyTerm(haystack, POSITIVE_TERMS);
  const hasExclusionTerm = hasAnyTerm(haystack, EXCLUSION_TERMS);

  let score = 0;
  if (durationMinutes >= minimumDurationMinutes) {
    score += 2;
  }
  if (durationMinutes >= 100) {
    score += 1;
  }
  if (hasPositiveTerm) {
    score += 3;
  }
  if (!hasExclusionTerm) {
    score += 1;
  } else {
    score -= 4;
  }
  if (title && !titleLooksSerial(title)) {
    score += 1;
  } else {
    score -= 2;
  }

  return {
    score,
    durationMinutes,
    hasPositiveTerm,
    hasExclusionTerm,
  };
}

function isMovieCandidate(event, minimumDurationMinutes, nowSeconds, latestStartSeconds) {
  const begin = Number(event.begin);
  const duration = Number(event.duration);
  if (!Number.isFinite(begin) || !Number.isFinite(duration)) {
    return null;
  }

  if (begin < nowSeconds || begin > latestStartSeconds) {
    return null;
  }

  const details = buildCandidateScore(event, minimumDurationMinutes);
  if (details.durationMinutes < minimumDurationMinutes) {
    return null;
  }

  const accepted = details.score >= 3 || (details.hasPositiveTerm && !details.hasExclusionTerm);
  if (!accepted) {
    return null;
  }

  return {
    durationMinutes: details.durationMinutes,
    heuristicScore: details.score,
  };
}

export async function findMovieCandidates({
  channels,
  settings,
  openwebif,
  wikipediaClient,
}) {
  const selectedChannelIds = new Set(settings.selectedChannels);
  const selectedChannels = channels.filter((channel) => selectedChannelIds.has(channel.channelId));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const latestStartSeconds = nowSeconds + settings.lookaheadHours * 3600;

  const epgResults = await Promise.allSettled(
    selectedChannels.map(async (channel) => ({
      channel,
      programmes: await openwebif.fetchEpgForService(channel.serviceRef),
    })),
  );

  const candidates = [];
  const errors = [];
  for (const result of epgResults) {
    if (result.status !== 'fulfilled') {
      errors.push(result.reason);
      continue;
    }

    const { channel, programmes } = result.value;
    for (const programme of programmes) {
      const match = isMovieCandidate(
        programme,
        settings.minimumDurationMinutes,
        nowSeconds,
        latestStartSeconds,
      );
      if (!match) {
        continue;
      }

      candidates.push({
        title: programme.title || channel.name,
        description: programme.description || '',
        begin: Number(programme.begin),
        end: Number(programme.begin) + Number(programme.duration),
        durationMinutes: match.durationMinutes,
        heuristicScore: match.heuristicScore,
        channelId: channel.channelId,
        channelName: channel.name,
        serviceRef: channel.serviceRef,
        logoUrl: channel.logoUrl,
      });
    }
  }

  candidates.sort((left, right) => {
    if (left.begin !== right.begin) {
      return left.begin - right.begin;
    }
    if (right.heuristicScore !== left.heuristicScore) {
      return right.heuristicScore - left.heuristicScore;
    }
    return left.title.localeCompare(right.title, 'de');
  });

  if (wikipediaClient) {
    const enrichmentByTitle = new Map();
    await Promise.all(
      candidates.map(async (candidate) => {
        const key = normalizeText(candidate.title);
        if (!enrichmentByTitle.has(key)) {
          enrichmentByTitle.set(
            key,
            wikipediaClient.lookupMovie(candidate.title).catch(() => null),
          );
        }

        candidate.wikipedia = await enrichmentByTitle.get(key);
      }),
    );
  }

  return {
    selectedChannels,
    candidates,
    stats: {
      selectedChannels: selectedChannels.length,
      candidates: candidates.length,
      lookaheadHours: settings.lookaheadHours,
      minimumDurationMinutes: settings.minimumDurationMinutes,
      failedChannels: errors.length,
    },
    errors,
  };
}
