export function serviceRefToChannelId(ref) {
  return String(ref || '').trim().replaceAll(':', '_');
}

export function buildStreamUrl(vuIp, serviceRef) {
  return `http://${vuIp}:8001/${encodeURIComponent(serviceRef)}`;
}

export function buildLogoUrl(baseUrl, channelId) {
  return `${baseUrl}/logos/${encodeURIComponent(channelId)}.png`;
}

export function buildBaseUrl(req, publicBaseUrl) {
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

export function buildM3uGroupTitle(bouquetName) {
  return String(bouquetName || '')
    .replace(/\s*\(TV\)\s*$/i, '')
    .trim();
}
