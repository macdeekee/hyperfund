import axios from 'axios';

const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.url = options.url;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export function createHttpClient(config, cache) {
  const client = axios.create({
    timeout: config.requestTimeoutMs,
    headers: {
      accept: 'application/json',
      'user-agent': 'hyperfund-cli/1.0'
    },
    validateStatus: status => status >= 200 && status < 300
  });

  return {
    async requestJson(request, options = {}) {
      const cacheKey = options.cacheKey ?? buildCacheKey(request);
      const ttlMs = options.ttlMs ?? config.cacheTtlMs;
      const canUseCache = cache && !config.disableCache;

      if (canUseCache && !config.forceRefresh) {
        const cached = await cache.read(cacheKey, { ttlMs });
        if (cached) {
          return { data: cached.data, fromCache: true, stale: false, fetchedAt: cached.fetchedAt };
        }
      }

      try {
        const data = await requestWithRetry(client, request, config);
        const fetchedAt = new Date().toISOString();

        if (canUseCache) {
          await cache.write(cacheKey, { data, fetchedAt });
        }

        return { data, fromCache: false, stale: false, fetchedAt };
      } catch (error) {
        if (canUseCache) {
          const cached = await cache.read(cacheKey, { allowExpired: true });
          if (cached) {
            return { data: cached.data, fromCache: true, stale: true, fetchedAt: cached.fetchedAt };
          }
        }

        throw error;
      }
    }
  };
}

async function requestWithRetry(client, request, config) {
  let lastError;

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const response = await client.request(request);
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const shouldRetry = attempt < config.retries && (!status || RETRY_STATUSES.has(status));

      if (!shouldRetry) {
        throw toApiError(error, request.url);
      }

      await delay(config.retryDelayMs * 2 ** attempt);
    }
  }

  throw toApiError(lastError, request.url);
}

function buildCacheKey(request) {
  return JSON.stringify({
    method: request.method ?? 'GET',
    url: request.url,
    params: request.params ?? null,
    data: request.data ?? null
  });
}

function toApiError(error, url) {
  if (error instanceof ApiError) {
    return error;
  }

  const status = error.response?.status;
  const statusText = status ? `HTTP ${status}` : error.code ?? 'request failed';
  return new ApiError(`API request failed for ${url}: ${statusText}`, {
    url,
    status,
    cause: error
  });
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
