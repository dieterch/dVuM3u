function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildXmltv({ channels, programmesByChannel, timeZone }) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="dVuM3u">'];

  for (const channel of channels) {
    lines.push(`  <channel id="${escapeXml(channel.channelId)}">`);
    lines.push(`    <display-name>${escapeXml(channel.name)}</display-name>`);
    if (channel.logoUrl) {
      lines.push(`    <icon src="${escapeXml(channel.logoUrl)}" />`);
    }
    lines.push('  </channel>');
  }

  for (const channel of channels) {
    const programmes = programmesByChannel.get(channel.channelId) || [];
    for (const programme of programmes) {
      const start = formatXmltvDate(programme.begin, timeZone);
      const stop = formatXmltvDate(programme.begin + programme.duration, timeZone);
      lines.push(
        `  <programme channel="${escapeXml(channel.channelId)}" start="${start}" stop="${stop}">`,
      );
      lines.push(`    <title>${escapeXml(programme.title || channel.name)}</title>`);
      if (programme.description) {
        lines.push(`    <desc>${escapeXml(programme.description)}</desc>`);
      }
      lines.push('  </programme>');
    }
  }

  lines.push('</tv>');
  return `${lines.join('\n')}\n`;
}

export function formatXmltvDate(unixSeconds, timeZone) {
  const date = new Date(unixSeconds * 1000);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const compact = `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
  const offset = (parts.timeZoneName || 'GMT+00:00').replace('GMT', '').replace(':', '');
  return `${compact} ${offset}`;
}
