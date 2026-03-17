import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import express from 'express';
import { readCredentials, getAccessToken, getSubscriptionInfo } from '../server/credentials.js';
import { createQuotaFetcher } from '../server/quota.js';
import { createApiRouter } from '../server/routes/api.js';

describe('readCredentials', () => {
  let tmpFile;

  after(() => { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); });

  it('returns claudeAiOauth from valid file', () => {
    tmpFile = path.join(os.tmpdir(), `creds-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { accessToken: 'sk-test-123', expiresAt: Date.now() + 60000 }
    }));
    const creds = readCredentials(tmpFile);
    expect(creds.accessToken).to.equal('sk-test-123');
  });

  it('returns null for missing file', () => {
    expect(readCredentials('/nonexistent/path.json')).to.be.null;
  });

  it('returns null for invalid JSON', () => {
    tmpFile = path.join(os.tmpdir(), `creds-bad-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, 'not json');
    expect(readCredentials(tmpFile)).to.be.null;
  });
});

describe('getAccessToken', () => {
  let tmpFile;

  after(() => { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); });

  it('returns token when not expired', () => {
    tmpFile = path.join(os.tmpdir(), `creds-valid-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { accessToken: 'sk-valid', expiresAt: Date.now() + 60000 }
    }));
    expect(getAccessToken(tmpFile)).to.equal('sk-valid');
  });

  it('returns null when expired', () => {
    tmpFile = path.join(os.tmpdir(), `creds-expired-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { accessToken: 'sk-expired', expiresAt: Date.now() - 1000 }
    }));
    expect(getAccessToken(tmpFile)).to.be.null;
  });
});

describe('createQuotaFetcher', () => {
  it('returns cached data within TTL', async () => {
    let callCount = 0;
    const mockData = { five_hour: { utilization: 42, resets_at: null } };
    const fetcher = createQuotaFetcher({
      cacheTtlMs: 200,
      getAccessToken: () => 'mock-token',
    });

    // Monkey-patch global fetch for this test
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      callCount++;
      return { ok: true, json: async () => mockData };
    };

    try {
      const r1 = await fetcher.fetchQuota();
      const r2 = await fetcher.fetchQuota();
      expect(r1.available).to.be.true;
      expect(r1.five_hour.utilization).to.equal(42);
      expect(callCount).to.equal(1); // Only one upstream call
      expect(r2.five_hour.utilization).to.equal(42);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('returns stale data on error after TTL', async () => {
    let callCount = 0;
    const fetcher = createQuotaFetcher({
      cacheTtlMs: 50,
      getAccessToken: () => 'mock-token',
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) return { ok: true, json: async () => ({ five_hour: { utilization: 10 } }) };
      return { ok: false, status: 429 };
    };

    try {
      const r1 = await fetcher.fetchQuota();
      expect(r1.available).to.be.true;
      await new Promise(r => setTimeout(r, 80));
      const r2 = await fetcher.fetchQuota();
      // Should return stale cached data
      expect(r2.available).to.be.true;
      expect(r2.five_hour.utilization).to.equal(10);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('returns unavailable when no credentials', async () => {
    const fetcher = createQuotaFetcher({
      getAccessToken: () => null,
    });
    const result = await fetcher.fetchQuota();
    expect(result.available).to.be.false;
    expect(result.error).to.equal('no_credentials');
  });
});

describe('GET /api/quota', () => {
  let server, baseUrl, tmpDir;

  before((done) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-test-'));
    const projectDir = path.join(tmpDir, '-Users-test-Workspace-testproject');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'sess.jsonl'),
      JSON.stringify({ type: 'assistant', sessionId: 's1', timestamp: '2026-03-10T10:00:00.000Z', message: { model: 'claude-sonnet-4-6', usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } })
    );

    const mockQuotaFetcher = {
      fetchQuota: async () => ({
        available: true,
        five_hour: { utilization: 25.5, resets_at: '2026-03-10T15:00:00Z' },
        seven_day: { utilization: 60.2, resets_at: null },
        lastFetched: new Date().toISOString(),
      }),
    };

    const app = express();
    app.use('/api', createApiRouter(tmpDir, { quotaFetcher: mockQuotaFetcher }));
    server = app.listen(0, () => { baseUrl = `http://localhost:${server.address().port}`; done(); });
  });

  after((done) => { server.close(() => { fs.rmSync(tmpDir, { recursive: true }); done(); }); });

  it('returns quota data with expected shape', async () => {
    const res = await fetch(`${baseUrl}/api/quota`);
    const data = await res.json();
    expect(data.available).to.be.true;
    expect(data.five_hour.utilization).to.equal(25.5);
    expect(data.seven_day.utilization).to.equal(60.2);
    expect(data.lastFetched).to.be.a('string');
  });
});

describe('GET /api/quota (unavailable)', () => {
  let server, baseUrl, tmpDir;

  before((done) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-unavail-'));
    const projectDir = path.join(tmpDir, '-Users-test-Workspace-testproject');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'sess.jsonl'),
      JSON.stringify({ type: 'assistant', sessionId: 's1', timestamp: '2026-03-10T10:00:00.000Z', message: { model: 'claude-sonnet-4-6', usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } })
    );

    const mockQuotaFetcher = {
      fetchQuota: async () => ({ available: false, error: 'no_credentials' }),
    };

    const app = express();
    app.use('/api', createApiRouter(tmpDir, { quotaFetcher: mockQuotaFetcher }));
    server = app.listen(0, () => { baseUrl = `http://localhost:${server.address().port}`; done(); });
  });

  after((done) => { server.close(() => { fs.rmSync(tmpDir, { recursive: true }); done(); }); });

  it('returns unavailable status gracefully', async () => {
    const res = await fetch(`${baseUrl}/api/quota`);
    const data = await res.json();
    expect(data.available).to.be.false;
    expect(data.error).to.equal('no_credentials');
  });
});

describe('getSubscriptionInfo', () => {
  let tmpFile;
  afterEach(() => { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); });

  it('detects max20x from rateLimitTier', () => {
    tmpFile = path.join(os.tmpdir(), `sub-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { subscriptionType: 'max', rateLimitTier: 'default_claude_max_20x' }
    }));
    const info = getSubscriptionInfo(tmpFile);
    expect(info.plan).to.equal('max20x');
  });

  it('detects max5x from rateLimitTier', () => {
    tmpFile = path.join(os.tmpdir(), `sub-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { subscriptionType: 'max', rateLimitTier: 'default_claude_max_5x' }
    }));
    const info = getSubscriptionInfo(tmpFile);
    expect(info.plan).to.equal('max5x');
  });

  it('detects pro from subscriptionType', () => {
    tmpFile = path.join(os.tmpdir(), `sub-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { subscriptionType: 'pro', rateLimitTier: '' }
    }));
    const info = getSubscriptionInfo(tmpFile);
    expect(info.plan).to.equal('pro');
  });

  it('returns null plan for unknown subscription', () => {
    tmpFile = path.join(os.tmpdir(), `sub-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({
      claudeAiOauth: { subscriptionType: 'free', rateLimitTier: '' }
    }));
    const info = getSubscriptionInfo(tmpFile);
    expect(info.plan).to.be.null;
  });

  it('returns null for missing file', () => {
    expect(getSubscriptionInfo('/nonexistent.json')).to.be.null;
  });
});

describe('GET /api/subscription', () => {
  let server, baseUrl, tmpDir;

  before((done) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sub-api-'));
    const projectDir = path.join(tmpDir, '-Users-test-Workspace-testproject');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'sess.jsonl'),
      JSON.stringify({ type: 'assistant', sessionId: 's1', timestamp: '2026-03-10T10:00:00.000Z', message: { model: 'claude-sonnet-4-6', usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } })
    );

    const app = express();
    app.use('/api', createApiRouter(tmpDir, {
      getSubscriptionInfo: () => ({ subscriptionType: 'max', rateLimitTier: 'default_claude_max_20x', plan: 'max20x' }),
    }));
    server = app.listen(0, () => { baseUrl = `http://localhost:${server.address().port}`; done(); });
  });

  after((done) => { server.close(() => { fs.rmSync(tmpDir, { recursive: true }); done(); }); });

  it('returns detected subscription plan', async () => {
    const res = await fetch(`${baseUrl}/api/subscription`);
    const data = await res.json();
    expect(data.plan).to.equal('max20x');
    expect(data.subscriptionType).to.equal('max');
    expect(data.rateLimitTier).to.equal('default_claude_max_20x');
  });
});
