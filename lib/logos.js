import { access } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';

export function createLogosMiddleware(logoDir) {
  return express.static(logoDir, {
    fallthrough: true,
    immutable: false,
    maxAge: '1h',
  });
}

export async function resolveLogoName(logoDir, channelId) {
  const candidates = [channelId];

  if (channelId.endsWith('_')) {
    candidates.push(channelId.slice(0, -1));
  }

  for (const candidate of candidates) {
    const filePath = path.join(logoDir, `${candidate}.png`);

    try {
      await access(filePath);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}
