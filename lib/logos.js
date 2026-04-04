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

export async function logoExists(logoDir, channelId) {
  const filePath = path.join(logoDir, `${channelId}.png`);

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
