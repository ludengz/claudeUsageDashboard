import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');
const KEYCHAIN_SERVICE = 'Claude Code-credentials';

function readFromKeychain() {
  if (process.platform !== 'darwin') return null;
  try {
    const raw = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    const data = JSON.parse(raw);
    return data.claudeAiOauth || null;
  } catch {
    return null;
  }
}

function readFromFile(credentialsPath) {
  try {
    const raw = fs.readFileSync(credentialsPath, 'utf-8');
    const data = JSON.parse(raw);
    return data.claudeAiOauth || null;
  } catch {
    return null;
  }
}

export function readCredentials(credentialsPath) {
  if (credentialsPath) {
    // Explicit path provided (e.g. tests) — skip Keychain
    return readFromFile(credentialsPath);
  }
  // Try macOS Keychain first, then fall back to default file
  return readFromKeychain() || readFromFile(CREDENTIALS_PATH);
}

export function getSubscriptionInfo(credentialsPath) {
  const creds = readCredentials(credentialsPath);
  if (!creds) return null;

  const { subscriptionType, rateLimitTier } = creds;
  const combined = `${subscriptionType || ''} ${rateLimitTier || ''}`.toLowerCase();

  let plan = null;
  if (combined.includes('20x')) plan = 'max20x';
  else if (combined.includes('5x')) plan = 'max5x';
  else if (combined.includes('pro')) plan = 'pro';

  return { subscriptionType: subscriptionType || null, rateLimitTier: rateLimitTier || null, plan };
}

export function getAccessToken(credentialsPath) {
  const creds = readCredentials(credentialsPath);
  if (!creds || !creds.accessToken) return null;
  if (creds.expiresAt && creds.expiresAt < Date.now()) return null;
  return creds.accessToken;
}
