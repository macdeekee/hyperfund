import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnalysis } from '../src/services/analysisPlatform.js';
import { HyperfundService } from '../src/services/hyperfundService.js';
import { buildForecast } from '../src/services/forecastService.js';
import { calculateFundamentalScore } from '../src/services/scoringService.js';
import { calculateTrend } from '../src/services/trendService.js';
import { buildValuationScenarios } from '../src/services/valuationService.js';

test('fetchSnapshot aggregates live source payloads into core metrics', async () => {
  const service = new HyperfundService({
    config: {
      aqav2FeeRateBps: 3,
      valuationMultiples: [10, 20]
    },
    hyperliquid: {
      getMetaAndAssetContexts: async () => response([
        {
          universe: [
            { name: 'HYPE' },
            { name: 'BTC' },
            { name: 'DELISTED', isDelisted: true }
          ]
        },
        [
          { markPx: '50', openInterest: '1000', dayNtlVlm: '2000000' },
          { markPx: '100000', openInterest: '10', dayNtlVlm: '3000000' },
          { markPx: '1', openInterest: '999999', dayNtlVlm: '999999' }
        ]
      ]),
      getAllMids: async () => response({ HYPE: '49' })
    },
    defillama: {
      getHypePrice: async () => response({ coins: { 'coingecko:hyperliquid': { price: 51 } } }),
      getHyperliquidProtocol: async () => response({
        mcap: 10_200_000_000,
        currentChainTvls: { 'Hyperliquid L1': 4_000_000_000 }
      }),
      getRevenueSummary: async () => response({
        total24h: 1_000_000,
        total7d: 14_000_000,
        total30d: 50_000_000
      }),
      getFeesSummary: async () => response({ total24h: 1_200_000 }),
      getStablecoins: async () => response({
        chains: [
          {
            name: 'Hyperliquid L1',
            totalCirculatingUSD: { peggedUSD: 3_500_000_000 }
          }
        ]
      })
    }
  });

  const snapshot = await service.fetchSnapshot();

  assert.equal(snapshot.metrics.price, 51);
  assert.equal(snapshot.metrics.marketCap, 10_200_000_000);
  assert.equal(snapshot.metrics.annualizedRevenue, 730_000_000);
  assert.equal(snapshot.metrics.stablecoinMarketCap, 3_500_000_000);
  assert.equal(snapshot.metrics.totalOpenInterestUsd, 1_050_000);
  assert.equal(snapshot.metrics.totalPerpVolume24h, 5_000_000);
  assert.equal(Math.round(snapshot.metrics.aqav2AnnualizedRevenue), 547_500);
  assert.equal(snapshot.metrics.hypeOpenInterestUsd, 50_000);
  assert.equal(snapshot.metrics.hypePerpVolume24h, 2_000_000);
  assert.equal(snapshot.valuationScenarios.length, 2);
  assert.equal(snapshot.sourceStatus.every(source => source.ok), true);
});

test('fetchSnapshot rejects all-null snapshots when every source fails', async () => {
  const failing = async () => {
    throw new Error('network unavailable');
  };

  const service = new HyperfundService({
    config: {
      aqav2FeeRateBps: 3,
      valuationMultiples: [10]
    },
    hyperliquid: {
      getMetaAndAssetContexts: failing,
      getAllMids: failing
    },
    defillama: {
      getHypePrice: failing,
      getHyperliquidProtocol: failing,
      getRevenueSummary: failing,
      getFeesSummary: failing,
      getStablecoins: failing
    }
  });

  await assert.rejects(
    () => service.fetchSnapshot(),
    /No usable HyperFund metrics were available/
  );
});

test('fundamental score and valuation scenarios are deterministic', () => {
  const metrics = {
    price: 50,
    marketCap: 10_000_000_000,
    annualizedRevenue: 1_000_000_000,
    buybacksAnnualized: 500_000_000,
    stablecoinMarketCap: 2_500_000_000,
    totalPerpVolume24h: 2_000_000_000
  };

  const score = calculateFundamentalScore(metrics);
  const scenarios = buildValuationScenarios(metrics, [10, 20]);

  assert.equal(score.weightedScore, 70.5);
  assert.equal(score.rating, 'Strong');
  assert.deepEqual(
    scenarios.map(scenario => ({
      multiple: scenario.multiple,
      impliedMarketCap: scenario.impliedMarketCap,
      impliedPrice: scenario.impliedPrice,
      upside: scenario.upside
    })),
    [
      { multiple: 10, impliedMarketCap: 10_000_000_000, impliedPrice: 50, upside: 0 },
      { multiple: 20, impliedMarketCap: 20_000_000_000, impliedPrice: 100, upside: 1 }
    ]
  );
});

test('calculateTrend compares latest snapshot against nearest baseline', () => {
  const trend = calculateTrend(
    [
      snapshot('2026-05-10', { price: 20, marketCap: 1_000 }, 40),
      snapshot('2026-06-01', { price: 30, marketCap: 1_500 }, 50),
      snapshot('2026-06-12', { price: 45, marketCap: 3_000 }, 75)
    ],
    7
  );

  const price = trend.rows.find(row => row.key === 'price');
  const score = trend.rows.find(row => row.key === 'weightedScore');

  assert.equal(trend.baseline.date, '2026-06-01');
  assert.equal(price.absoluteChange, 15);
  assert.equal(price.percentChange, 0.5);
  assert.equal(score.absoluteChange, 25);
  assert.equal(score.percentChange, 0.5);
});

test('buildForecast creates scenario bands and driver attribution', () => {
  const current = {
    date: '2026-06-12',
    metrics: {
      price: 50,
      marketCap: 10_000_000_000,
      annualizedRevenue: 1_000_000_000,
      revenue7d: 21_000_000,
      revenue30d: 75_000_000,
      buybackYield: 0.06,
      revenueMultiple: 10,
      stablecoinToMarketCap: 0.4,
      volumeToMarketCap: 0.3,
      weightedScore: 80
    },
    score: { weightedScore: 80 },
    sourceStatus: [
      { ok: true, stale: false },
      { ok: true, stale: false }
    ]
  };

  const forecast = buildForecast(current, [
    snapshot('2026-06-01', { totalPerpVolume24h: 1_000_000_000 }, 60),
    current
  ]);

  assert.equal(forecast.signal, 'Deep value');
  assert.equal(forecast.confidence, 'Medium');
  assert.ok(forecast.fairBear < forecast.fairBase);
  assert.ok(forecast.fairBase < forecast.fairBull);
  assert.ok(forecast.drivers.length >= 5);
});

test('buildAnalysis answers valuation and capital allocation questions', () => {
  const latest = {
    date: '2026-06-13',
    capturedAt: '2026-06-13T00:00:00.000Z',
    metrics: {
      price: 60,
      marketCap: 20_000_000_000,
      annualizedRevenue: 1_000_000_000,
      buybacksAnnualized: 970_000_000,
      buybacks24h: 2_000_000,
      revenue30d: 58_400_000,
      stablecoinMarketCap: 6_000_000_000,
      totalOpenInterestUsd: 5_500_000_000,
      totalPerpVolume24h: 4_000_000_000,
      aqav2AnnualizedRevenue: 292_000_000,
      revenue7d: 18_000_000
    }
  };
  const history = [
    {
      date: '2026-05-14',
      timestamp: Date.parse('2026-05-14T00:00:00.000Z'),
      revenue: 700_000_000,
      buybacks: 650_000_000,
      stablecoins: 4_500_000_000,
      openInterest: 4_000_000_000,
      volume: 3_200_000_000,
      marketCap: 16_000_000_000,
      hypePrice: 48,
      revenueYield: 0.04375
    }
  ];

  const analysis = buildAnalysis(latest, history);

  assert.ok(analysis.buybackVelocity.annualHypePurchased > 16_000_000);
  assert.ok(analysis.buybackVelocity.supplyAbsorptionRate > 0.04);
  assert.equal(analysis.aqaImpact.find(scenario => scenario.name === 'Base').newRevenue, 1_292_000_000);
  assert.equal(analysis.revenueYield.comparisons.length, 4);
  assert.ok(analysis.fairValue.composite.fairValue > latest.metrics.price);
  const weightedComposite =
    analysis.fairValue.revenueMultipleModel.fairValue * 0.4 +
    analysis.fairValue.buybackYieldModel.fairValue * 0.4 +
    analysis.fairValue.dcfModel.fairValue * 0.2;
  assert.equal(Math.round(analysis.fairValue.composite.fairValue * 100), Math.round(weightedComposite * 100));
  assert.ok(analysis.retirement.remainingSupply5Y > analysis.retirement.remainingSupply10Y);
  assert.ok(analysis.retirement.remainingSupply10Y > analysis.retirement.remainingSupply15Y);
  assert.equal(analysis.confidence.label, 'Low');
  assert.equal(analysis.capitalAllocation.revenueYield, 0.05);
  assert.equal(analysis.exchangeComparables.at(-1).name, 'Intercontinental Exchange');
  assert.match(analysis.health.overall.grade, /^[A-D][+-]?$/);
  assert.ok(analysis.signals.some(signal => signal.label === 'Revenue accelerating'));
});

test('growth engine returns n/a instead of reusing shorter lookbacks', () => {
  const latest = {
    date: '2026-06-13',
    capturedAt: '2026-06-13T00:00:00.000Z',
    metrics: {
      price: 60,
      marketCap: 20_000_000_000,
      annualizedRevenue: 1_000_000_000,
      buybacksAnnualized: 970_000_000,
      stablecoinMarketCap: 6_000_000_000,
      totalOpenInterestUsd: 5_500_000_000,
      totalPerpVolume24h: 4_000_000_000,
      revenue7d: 18_000_000,
      revenue30d: 58_400_000
    }
  };
  const history = [
    {
      date: '2026-06-10',
      timestamp: Date.parse('2026-06-10T00:00:00.000Z'),
      revenue: 900_000_000,
      buybacks: 800_000_000,
      stablecoins: 5_500_000_000,
      openInterest: 5_000_000_000,
      volume: 3_700_000_000,
      marketCap: 18_000_000_000,
      hypePrice: 54,
      revenueYield: 0.05
    }
  ];

  const analysis = buildAnalysis(latest, history);

  assert.equal(analysis.growth.revenue7dGrowth, null);
  assert.equal(analysis.growth.revenue30dGrowth, null);
  assert.ok(analysis.dataWarnings.some(warning => warning.includes('required lookback')));
});

function response(data) {
  return {
    data,
    fromCache: false,
    stale: false,
    fetchedAt: '2026-06-12T00:00:00.000Z'
  };
}

function snapshot(date, metrics, weightedScore) {
  return {
    date,
    metrics,
    score: { weightedScore }
  };
}
