import { getAccessToken } from './credentials.js';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

export function createQuotaFetcher(options = {}) {
  const CACHE_TTL = options.cacheTtlMs || 120_000;
  const getToken = options.getAccessToken || getAccessToken;
  let cached = null;
  let lastFetched = 0;
  let fetchInProgress = null;

  async function fetchQuota() {
    const now = Date.now();
    if (cached && (now - lastFetched) < CACHE_TTL) return cached;
    if (fetchInProgress) return fetchInProgress;

    fetchInProgress = (async () => {
      try {
        const token = getToken();
        if (!token) return cached || { available: false, error: 'no_credentials' };

        const res = await fetch(USAGE_URL, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'anthropic-beta': 'oauth-2025-04-20',
          },
        });

        if (!res.ok) {
          if (res.status === 429) return cached || { available: false, error: 'rate_limited' };
          return cached || { available: false, error: `http_${res.status}` };
        }

        const data = await res.json();
        cached = { available: true, ...data, lastFetched: new Date().toISOString() };
        lastFetched = Date.now();
        return cached;
      } catch (err) {
        return cached || { available: false, error: err.message };
      } finally {
        fetchInProgress = null;
      }
    })();

    return fetchInProgress;
  }

  return { fetchQuota };
}
