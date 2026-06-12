import os from 'node:os';
import path from 'node:path';

const DEFAULTS = {
  cacheTtlMs: 60_000,
  requestTimeoutMs: 12_000,
  retries: 2,
  retryDelayMs: 500,
  aqav2FeeRateBps: 3.0,
  valuationMultiples: [10, 15, 20, 25, 30],
  hyperliquidBaseUrl: 'https://api.hyperliquid.xyz',
  defillamaBaseUrl: 'https://api.llama.fi',
  defillamaCoinsUrl: 'https://coins.llama.fi',
  defillamaStablecoinsUrl: 'https://stablecoins.llama.fi'
};

export function createConfig(options = {}) {
  const dataDir = path.resolve(
    expandHome(options.dataDir ?? process.env.HYPERFUND_DATA_DIR ?? '~/.hyperfund')
  );

  const cacheTtlMs = parsePositiveInteger(
    options.cacheTtlMs ?? process.env.HYPERFUND_CACHE_TTL_MS,
    DEFAULTS.cacheTtlMs
  );

  const requestTimeoutMs = parsePositiveInteger(
    options.timeoutMs ?? process.env.HYPERFUND_REQUEST_TIMEOUT_MS,
    DEFAULTS.requestTimeoutMs
  );

  const retries = parseNonNegativeInteger(
    options.retries ?? process.env.HYPERFUND_RETRIES,
    DEFAULTS.retries
  );

  const aqav2FeeRateBps = parsePositiveNumber(
    options.aqav2FeeRateBps ?? process.env.HYPERFUND_AQAV2_FEE_RATE_BPS,
    DEFAULTS.aqav2FeeRateBps
  );

  return {
    ...DEFAULTS,
    cacheTtlMs,
    requestTimeoutMs,
    retries,
    aqav2FeeRateBps,
    dataDir,
    cacheDir: path.join(dataDir, 'cache'),
    snapshotsDir: path.join(dataDir, 'snapshots'),
    disableCache: options.cache === false || process.env.HYPERFUND_DISABLE_CACHE === '1',
    forceRefresh: Boolean(options.refresh)
  };
}

function expandHome(input) {
  if (!input || input === '~') {
    return os.homedir();
  }

  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
