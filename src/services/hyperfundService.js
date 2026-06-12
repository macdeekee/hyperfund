import { createDefillamaClient } from '../api/defillamaClient.js';
import { createHttpClient } from '../api/httpClient.js';
import { createHyperliquidClient } from '../api/hyperliquidClient.js';
import { CacheService } from './cacheService.js';
import { calculateFundamentalScore } from './scoringService.js';
import { SnapshotStore, toUtcDate } from './snapshotStore.js';
import { buildValuationScenarios } from './valuationService.js';

export function createHyperfundServices(config) {
  const cache = new CacheService(config.cacheDir);
  const http = createHttpClient(config, cache);

  return {
    hyperfund: new HyperfundService({
      config,
      hyperliquid: createHyperliquidClient(config, http),
      defillama: createDefillamaClient(config, http)
    }),
    snapshots: new SnapshotStore(config.snapshotsDir)
  };
}

export class HyperfundService {
  constructor({ config, hyperliquid, defillama }) {
    this.config = config;
    this.hyperliquid = hyperliquid;
    this.defillama = defillama;
  }

  async fetchSnapshot() {
    const results = await settleSources({
      hyperliquidContexts: () => this.hyperliquid.getMetaAndAssetContexts(),
      hyperliquidMids: () => this.hyperliquid.getAllMids(),
      hypePrice: () => this.defillama.getHypePrice(),
      protocol: () => this.defillama.getHyperliquidProtocol(),
      revenue: () => this.defillama.getRevenueSummary(),
      fees: () => this.defillama.getFeesSummary(),
      stablecoins: () => this.defillama.getStablecoins()
    });

    const hyperliquidMetrics = parseHyperliquidMetrics(sourceData(results.hyperliquidContexts));
    const mids = sourceData(results.hyperliquidMids) ?? {};
    const priceData = parseHypePrice(sourceData(results.hypePrice));
    const protocolData = parseProtocolData(sourceData(results.protocol));
    const revenueData = parseRevenueSummary(sourceData(results.revenue));
    const feesData = parseFeesSummary(sourceData(results.fees));
    const stablecoinData = parseStablecoinData(sourceData(results.stablecoins));

    const price = firstFinite(priceData.price, numberFrom(mids.HYPE), hyperliquidMetrics.hypePrice);
    const marketCap = firstFinite(protocolData.marketCap, null);
    const annualizedRevenue = firstFinite(revenueData.annualized7d, revenueData.annualized24h);
    const buybacks24h = firstFinite(revenueData.total24h, null);
    const buybacksAnnualized = firstFinite(revenueData.annualized7d, revenueData.annualized24h);
    const aqav2DailyRevenue = calculateAqav2Revenue(
      hyperliquidMetrics.totalPerpVolume24h,
      this.config.aqav2FeeRateBps
    );
    const aqav2AnnualizedRevenue = isFiniteNumber(aqav2DailyRevenue) ? aqav2DailyRevenue * 365 : null;

    const metrics = {
      price,
      marketCap,
      annualizedRevenue,
      revenue24h: revenueData.total24h,
      revenue7d: revenueData.total7d,
      revenue30d: revenueData.total30d,
      fees24h: feesData.total24h,
      buybacks24h,
      buybacksAnnualized,
      stablecoinMarketCap: stablecoinData.marketCap,
      aqav2DailyRevenue,
      aqav2AnnualizedRevenue,
      totalOpenInterestUsd: hyperliquidMetrics.totalOpenInterestUsd,
      totalPerpVolume24h: hyperliquidMetrics.totalPerpVolume24h,
      hypeOpenInterestUsd: hyperliquidMetrics.hypeOpenInterestUsd,
      hypePerpVolume24h: hyperliquidMetrics.hypePerpVolume24h,
      tvl: protocolData.tvl,
      activePerpMarkets: hyperliquidMetrics.activePerpMarkets,
      revenueMultiple: ratio(marketCap, annualizedRevenue),
      buybackYield: ratio(buybacksAnnualized, marketCap),
      stablecoinToMarketCap: ratio(stablecoinData.marketCap, marketCap),
      volumeToMarketCap: ratio(hyperliquidMetrics.totalPerpVolume24h, marketCap)
    };

    const statuses = sourceStatus(results);

    if (!hasUsableMetrics(metrics)) {
      const failures = statuses
        .filter(source => !source.ok)
        .map(source => `${source.name}: ${source.message}`)
        .join('; ');

      throw new Error(
        `No usable HyperFund metrics were available from live APIs or cache.${failures ? ` ${failures}` : ''}`
      );
    }

    const score = calculateFundamentalScore(metrics);
    const valuationScenarios = buildValuationScenarios(metrics, this.config.valuationMultiples);

    return {
      schemaVersion: 1,
      date: toUtcDate(),
      capturedAt: new Date().toISOString(),
      metrics,
      score,
      valuationScenarios,
      formulas: {
        annualizedRevenue: 'DefiLlama dailyRevenue 7d average x 365, falling back to 24h x 365',
        buybacks: 'DefiLlama dailyRevenue is used as HYPE buyback run-rate proxy',
        aqav2EstimatedRevenue: `Hyperliquid 24h perp volume x ${this.config.aqav2FeeRateBps} bps x 365`,
        openInterest: 'Sum of per-market open interest x mark price from Hyperliquid metaAndAssetCtxs',
        score: 'Weighted composite of revenue scale, revenue multiple, buyback yield, stablecoin base, and market activity'
      },
      sourceStatus: statuses
    };
  }
}

async function settleSources(sources) {
  const entries = await Promise.all(
    Object.entries(sources).map(async ([name, fetcher]) => {
      try {
        return [name, { ok: true, value: await fetcher() }];
      } catch (error) {
        return [name, { ok: false, error }];
      }
    })
  );

  return Object.fromEntries(entries);
}

function sourceData(result) {
  return result?.ok ? result.value.data : null;
}

function sourceStatus(results) {
  return Object.entries(results).map(([name, result]) => {
    if (!result.ok) {
      return {
        name,
        ok: false,
        message: result.error?.message ?? 'Unavailable'
      };
    }

    return {
      name,
      ok: true,
      fromCache: result.value.fromCache,
      stale: result.value.stale,
      fetchedAt: result.value.fetchedAt
    };
  });
}

function parseHyperliquidMetrics(payload) {
  if (!Array.isArray(payload) || payload.length < 2) {
    return emptyHyperliquidMetrics();
  }

  const [meta, contexts] = payload;
  const universe = Array.isArray(meta?.universe) ? meta.universe : [];
  const markets = universe.map((asset, index) => ({
    ...asset,
    context: contexts[index] ?? {}
  }));

  let totalOpenInterestUsd = 0;
  let totalPerpVolume24h = 0;
  let activePerpMarkets = 0;
  let hype = null;

  for (const market of markets) {
    if (market.isDelisted) {
      continue;
    }

    const context = market.context;
    const markPrice = firstFinite(numberFrom(context.markPx), numberFrom(context.midPx), numberFrom(context.oraclePx));
    const openInterest = numberFrom(context.openInterest);
    const volume24h = numberFrom(context.dayNtlVlm);

    if (isFiniteNumber(openInterest) && isFiniteNumber(markPrice)) {
      totalOpenInterestUsd += openInterest * markPrice;
    }

    if (isFiniteNumber(volume24h)) {
      totalPerpVolume24h += volume24h;
    }

    if (isFiniteNumber(openInterest) && openInterest > 0) {
      activePerpMarkets += 1;
    }

    if (market.name === 'HYPE') {
      hype = { context, markPrice, openInterest, volume24h };
    }
  }

  const hypePrice = firstFinite(hype?.markPrice, numberFrom(hype?.context?.midPx), numberFrom(hype?.context?.oraclePx));
  const hypeOpenInterestUsd =
    isFiniteNumber(hype?.openInterest) && isFiniteNumber(hypePrice) ? hype.openInterest * hypePrice : null;

  return {
    totalOpenInterestUsd,
    totalPerpVolume24h,
    activePerpMarkets,
    hypePrice,
    hypeOpenInterestUsd,
    hypePerpVolume24h: hype?.volume24h ?? null
  };
}

function emptyHyperliquidMetrics() {
  return {
    totalOpenInterestUsd: null,
    totalPerpVolume24h: null,
    activePerpMarkets: null,
    hypePrice: null,
    hypeOpenInterestUsd: null,
    hypePerpVolume24h: null
  };
}

function parseHypePrice(payload) {
  const coin = payload?.coins?.['coingecko:hyperliquid'];
  return {
    price: numberFrom(coin?.price),
    timestamp: coin?.timestamp ?? null,
    confidence: numberFrom(coin?.confidence)
  };
}

function parseProtocolData(payload) {
  return {
    marketCap: numberFrom(payload?.mcap),
    tvl: firstFinite(
      numberFrom(payload?.currentChainTvls?.['Hyperliquid L1']),
      numberFrom(payload?.currentChainTvls?.Hyperliquid)
    )
  };
}

function parseRevenueSummary(payload) {
  const total24h = numberFrom(payload?.total24h);
  const total7d = numberFrom(payload?.total7d);
  const total30d = numberFrom(payload?.total30d);

  return {
    total24h,
    total7d,
    total30d,
    annualized24h: isFiniteNumber(total24h) ? total24h * 365 : null,
    annualized7d: isFiniteNumber(total7d) ? (total7d / 7) * 365 : null
  };
}

function parseFeesSummary(payload) {
  return {
    total24h: numberFrom(payload?.total24h),
    total7d: numberFrom(payload?.total7d),
    total30d: numberFrom(payload?.total30d)
  };
}

function parseStablecoinData(payload) {
  const chainNames = new Set(['Hyperliquid L1', 'Hyperliquid']);
  const chainTotal = payload?.chains?.find(chain => chainNames.has(chain.name))?.totalCirculatingUSD?.peggedUSD;

  if (isFiniteNumber(numberFrom(chainTotal))) {
    return { marketCap: numberFrom(chainTotal) };
  }

  const assets = Array.isArray(payload?.peggedAssets) ? payload.peggedAssets : [];
  const marketCap = assets.reduce((sum, asset) => {
    const chainCirculating = asset.chainCirculating ?? {};
    const value = [...chainNames]
      .map(chainName => numberFrom(chainCirculating[chainName]?.current?.peggedUSD))
      .find(isFiniteNumber);

    return sum + (value ?? 0);
  }, 0);

  return { marketCap: marketCap > 0 ? marketCap : null };
}

function calculateAqav2Revenue(perpVolume24h, feeRateBps) {
  if (!isFiniteNumber(perpVolume24h)) {
    return null;
  }

  return perpVolume24h * (feeRateBps / 10_000);
}

function ratio(numerator, denominator) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function hasUsableMetrics(metrics) {
  return [
    metrics.price,
    metrics.marketCap,
    metrics.annualizedRevenue,
    metrics.stablecoinMarketCap,
    metrics.totalOpenInterestUsd,
    metrics.totalPerpVolume24h
  ].some(isFiniteNumber);
}

function firstFinite(...values) {
  return values.find(isFiniteNumber) ?? null;
}

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
