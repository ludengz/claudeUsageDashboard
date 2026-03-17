import fs from 'fs';
import path from 'path';
import os from 'os';

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

export function readCredentials(credentialsPath = CREDENTIALS_PATH) {
  try {
    const raw = fs.readFileSync(credentialsPath, 'utf-8');
    const data = JSON.parse(raw);
    return data.claudeAiOauth || null;
  } catch {
    return null;
  }
}

export function getAccessToken(credentialsPath = CREDENTIALS_PATH) {
  const creds = readCredentials(credentialsPath);
  if (!creds || !creds.accessToken) return null;
  if (creds.expiresAt && creds.expiresAt < Date.now()) return null;
  return creds.accessToken;
}
