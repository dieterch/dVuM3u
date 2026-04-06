function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildDiscoverPayload({ baseUrl, config }) {
  return {
    FriendlyName: config.hdhr.friendlyName,
    Manufacturer: config.hdhr.manufacturer,
    ModelNumber: config.hdhr.modelNumber,
    FirmwareName: config.hdhr.firmwareName,
    FirmwareVersion: config.hdhr.firmwareVersion,
    DeviceID: config.hdhr.deviceId,
    DeviceAuth: config.hdhr.deviceAuth,
    BaseURL: baseUrl,
    LineupURL: `${baseUrl}/lineup.json`,
  };
}

export function buildLineupStatusPayload(channelCount) {
  return {
    ScanInProgress: 0,
    ScanPossible: 1,
    Source: 'Cable',
    SourceList: ['Cable'],
    Progress: 100,
    Found: channelCount,
  };
}

export function buildLineupPayload(channels, baseUrl) {
  return channels.map((channel, index) => ({
    GuideNumber: String(index + 1),
    GuideName: channel.name,
    URL: `${baseUrl}/stream/${encodeURIComponent(channel.serviceRef)}`,
  }));
}

export function buildDeviceXml({ config }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <device>
    <friendlyName>${escapeXml(config.hdhr.friendlyName)}</friendlyName>
    <manufacturer>${escapeXml(config.hdhr.manufacturer)}</manufacturer>
    <modelNumber>${escapeXml(config.hdhr.modelNumber)}</modelNumber>
    <serialNumber>${escapeXml(config.hdhr.deviceId)}</serialNumber>
  </device>
</root>
`;
}
