export function buildValuationScenarios(metrics, multiples) {
  const revenueBase = firstFinite(metrics.annualizedRevenue, metrics.aqav2AnnualizedRevenue);
  const impliedSupply = inferSupply(metrics.price, metrics.marketCap);

  return multiples.map(multiple => {
    const impliedMarketCap = isFiniteNumber(revenueBase) ? revenueBase * multiple : null;
    const impliedPrice =
      isFiniteNumber(impliedMarketCap) && isFiniteNumber(impliedSupply) ? impliedMarketCap / impliedSupply : null;
    const upside =
      isFiniteNumber(impliedMarketCap) && isFiniteNumber(metrics.marketCap) && metrics.marketCap > 0
        ? impliedMarketCap / metrics.marketCap - 1
        : null;

    return {
      multiple,
      impliedMarketCap,
      impliedPrice,
      upside
    };
  });
}

function inferSupply(price, marketCap) {
  if (!isFiniteNumber(price) || !isFiniteNumber(marketCap) || price <= 0) {
    return null;
  }

  return marketCap / price;
}

function firstFinite(...values) {
  return values.find(isFiniteNumber) ?? null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
