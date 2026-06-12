export function calculateFundamentalScore(metrics) {
  const components = [
    {
      name: 'Revenue Scale',
      weight: 0.25,
      score: scaledScore(metrics.annualizedRevenue, 1_000_000_000)
    },
    {
      name: 'Revenue Multiple',
      weight: 0.2,
      score: inverseRangeScore(safeDivide(metrics.marketCap, metrics.annualizedRevenue), 10, 60)
    },
    {
      name: 'Buyback Yield',
      weight: 0.2,
      score: scaledScore(safeDivide(metrics.buybacksAnnualized, metrics.marketCap), 0.1)
    },
    {
      name: 'Stablecoin Base',
      weight: 0.15,
      score: scaledScore(metrics.stablecoinMarketCap, 5_000_000_000)
    },
    {
      name: 'Market Activity',
      weight: 0.2,
      score: scaledScore(safeDivide(metrics.totalPerpVolume24h, metrics.marketCap), 0.5)
    }
  ];

  const weightedScore = components.reduce((sum, component) => sum + component.score * component.weight, 0);

  return {
    weightedScore: round(weightedScore, 1),
    rating: scoreRating(weightedScore),
    components: components.map(component => ({
      ...component,
      score: round(component.score, 1)
    }))
  };
}

function scaledScore(value, target) {
  if (!isFiniteNumber(value) || !isFiniteNumber(target) || target <= 0) {
    return 0;
  }

  return clamp((value / target) * 100, 0, 100);
}

function inverseRangeScore(value, good, bad) {
  if (!isFiniteNumber(value) || value <= 0) {
    return 0;
  }

  if (value <= good) {
    return 100;
  }

  if (value >= bad) {
    return 0;
  }

  return clamp(100 - ((value - good) / (bad - good)) * 100, 0, 100);
}

function safeDivide(numerator, denominator) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function scoreRating(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Balanced';
  if (score >= 35) return 'Developing';
  return 'Speculative';
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
