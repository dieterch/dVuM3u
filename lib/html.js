function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(unixSeconds, timeZone) {
  return new Intl.DateTimeFormat('de-AT', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unixSeconds * 1000));
}

function renderChannelOption(channel, selectedChannels) {
  const checked = selectedChannels.has(channel.channelId) ? ' checked' : '';
  const logo = channel.logoUrl
    ? `<img src="${escapeHtml(channel.logoUrl)}" alt="" loading="lazy">`
    : '<span class="channel-logo channel-logo--placeholder">TV</span>';

  return `
    <label class="channel-option">
      <input type="checkbox" name="selectedChannels" value="${escapeHtml(channel.channelId)}"${checked}>
      ${logo}
      <span>${escapeHtml(channel.name)}</span>
    </label>
  `;
}

function renderMovieCard(movie, timeZone) {
  const wikipedia = movie.wikipedia
    ? `
      <p class="movie-meta">
        ${movie.wikipedia.year ? `<span>Jahr ${escapeHtml(movie.wikipedia.year)}</span>` : ''}
        ${movie.wikipedia.confidence ? `<span>Wikipedia-Match ${escapeHtml(movie.wikipedia.confidence)}</span>` : ''}
      </p>
      ${movie.wikipedia.description ? `<p class="movie-copy">${escapeHtml(movie.wikipedia.description)}</p>` : ''}
      <p><a href="${escapeHtml(movie.wikipedia.url)}" target="_blank" rel="noreferrer">Wikipedia öffnen</a></p>
    `
    : '';
  const description = movie.wikipedia?.description ? '' : movie.description;

  return `
    <article class="movie-card">
      <header>
        ${movie.logoUrl ? `<img class="movie-logo" src="${escapeHtml(movie.logoUrl)}" alt="" loading="lazy">` : ''}
        <div>
          <h3>${escapeHtml(movie.title)}</h3>
          <p class="movie-meta">
            <span>${escapeHtml(movie.channelName)}</span>
            <span>${escapeHtml(formatDateTime(movie.begin, timeZone))}</span>
            <span>${escapeHtml(movie.durationMinutes)} Min.</span>
          </p>
        </div>
      </header>
      ${description ? `<p class="movie-copy">${escapeHtml(description)}</p>` : ''}
      ${wikipedia}
    </article>
  `;
}

export function renderMoviesPage({
  channels,
  settings,
  results,
  timeZone,
  action = '/movies',
}) {
  const selectedChannels = new Set(settings.selectedChannels);
  const cards = results
    ? results.candidates.map((movie) => renderMovieCard(movie, timeZone)).join('\n')
    : '';
  const summary = results
    ? `<p class="lede">Gefunden: ${results.stats.candidates} Kandidaten auf ${results.stats.selectedChannels} Sendern im Fenster der nächsten ${results.stats.lookaheadHours} Stunden.</p>`
    : '<p class="lede">Waehle Sender, Zeitraum und Mindestdauer aus und lasse dir kommende Spielfilm-Kandidaten direkt aus dem Bouquet anzeigen.</p>';
  const resultBlock = results
    ? results.candidates.length
      ? `<section class="results-grid">${cards}</section>`
      : '<section class="empty-state"><p>Keine Filmkandidaten im gewählten Zeitfenster gefunden.</p></section>'
    : '';
  const warning = results?.stats.failedChannels
    ? `<p class="notice">EPG-Abrufe für ${results.stats.failedChannels} Sender sind fehlgeschlagen. Die übrigen Ergebnisse werden trotzdem angezeigt.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>dVuM3u Filmfinder</title>
    <style>
      :root {
        --paper: #f5efe2;
        --ink: #1e1b18;
        --muted: #6a5f54;
        --line: #c9bca8;
        --accent: #8f2d1d;
        --card: rgba(255, 251, 244, 0.88);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at top, rgba(143, 45, 29, 0.08), transparent 28%),
          linear-gradient(180deg, #f7f1e4 0%, #efe4d1 100%);
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 56px;
      }
      .masthead {
        border-top: 5px double var(--ink);
        border-bottom: 5px double var(--ink);
        padding: 18px 0;
        margin-bottom: 24px;
        text-align: center;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.4rem, 6vw, 4.5rem);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .subtitle, .lede, .notice {
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.6;
      }
      .layout {
        display: grid;
        gap: 24px;
        grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      }
      .panel, .movie-card, .empty-state {
        border: 1px solid var(--line);
        background: var(--card);
        box-shadow: 0 10px 30px rgba(33, 24, 18, 0.08);
      }
      .panel {
        padding: 18px;
        position: sticky;
        top: 18px;
        align-self: start;
      }
      .form-row {
        margin-bottom: 16px;
      }
      .form-row label, .section-label {
        display: block;
        font-weight: 700;
        margin-bottom: 8px;
      }
      input[type="number"] {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--line);
        background: #fffdf8;
        font: inherit;
      }
      .channel-grid {
        display: grid;
        gap: 10px;
        max-height: 55vh;
        overflow: auto;
        padding-right: 4px;
      }
      .channel-option {
        display: grid;
        grid-template-columns: 18px 36px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        padding: 8px 10px;
        border: 1px solid transparent;
        background: rgba(255, 255, 255, 0.5);
      }
      .channel-option:hover {
        border-color: var(--line);
      }
      .channel-option img, .channel-logo--placeholder, .movie-logo {
        width: 36px;
        height: 36px;
        object-fit: contain;
        background: #fff;
        border: 1px solid var(--line);
        padding: 4px;
      }
      .channel-logo--placeholder {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--muted);
        font-size: 0.7rem;
      }
      button {
        width: 100%;
        padding: 12px 16px;
        border: 0;
        background: var(--accent);
        color: #fffaf3;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .results-grid {
        display: grid;
        gap: 18px;
      }
      .movie-card, .empty-state {
        padding: 18px;
      }
      .movie-card header {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        align-items: start;
        margin-bottom: 12px;
      }
      .movie-card h3 {
        margin: 0 0 4px;
        font-size: 1.55rem;
      }
      .movie-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 0;
        color: var(--muted);
        font-size: 0.95rem;
      }
      .movie-copy {
        margin: 0 0 12px;
        line-height: 1.65;
      }
      a {
        color: var(--accent);
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .panel {
          position: static;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="masthead">
        <p class="subtitle">dVuM3u Sonderausgabe</p>
        <h1>Filmfinder</h1>
        <p class="subtitle">Kommende Spielfilm-Kandidaten direkt aus deinem Bouquet.</p>
      </section>
      ${summary}
      ${warning}
      <section class="layout">
        <form class="panel" method="post" action="${escapeHtml(action)}">
          <div class="form-row">
            <label for="minimumDurationMinutes">Mindestdauer in Minuten</label>
            <input id="minimumDurationMinutes" name="minimumDurationMinutes" type="number" min="30" max="360" value="${escapeHtml(settings.minimumDurationMinutes)}">
          </div>
          <div class="form-row">
            <label for="lookaheadHours">Lookahead in Stunden</label>
            <input id="lookaheadHours" name="lookaheadHours" type="number" min="1" max="336" value="${escapeHtml(settings.lookaheadHours)}">
          </div>
          <div class="form-row">
            <span class="section-label">Senderauswahl</span>
            <div class="channel-grid">
              ${channels.map((channel) => renderChannelOption(channel, selectedChannels)).join('\n')}
            </div>
          </div>
          <button type="submit">Filme anzeigen</button>
          <p class="subtitle">JSON-Ansicht: <a href="/movies.json">/movies.json</a></p>
        </form>
        <section>
          ${resultBlock}
        </section>
      </section>
    </main>
  </body>
</html>
`;
}
