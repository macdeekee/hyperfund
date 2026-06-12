export function createDefillamaClient(config, http) {
  return {
    async getHypePrice() {
      return http.requestJson(
        {
          method: 'GET',
          url: `${config.defillamaCoinsUrl}/prices/current/coingecko:hyperliquid`
        },
        { cacheKey: 'defillama:hypePrice' }
      );
    },

    async getHyperliquidProtocol() {
      return http.requestJson(
        {
          method: 'GET',
          url: `${config.defillamaBaseUrl}/protocol/hyperliquid`
        },
        { cacheKey: 'defillama:protocol:hyperliquid' }
      );
    },

    async getRevenueSummary() {
      return http.requestJson(
        {
          method: 'GET',
          url: `${config.defillamaBaseUrl}/summary/fees/hyperliquid`,
          params: { dataType: 'dailyRevenue' }
        },
        { cacheKey: 'defillama:summary:dailyRevenue' }
      );
    },

    async getFeesSummary() {
      return http.requestJson(
        {
          method: 'GET',
          url: `${config.defillamaBaseUrl}/summary/fees/hyperliquid`,
          params: { dataType: 'dailyFees' }
        },
        { cacheKey: 'defillama:summary:dailyFees' }
      );
    },

    async getStablecoins() {
      return http.requestJson(
        {
          method: 'GET',
          url: `${config.defillamaStablecoinsUrl}/stablecoins`,
          params: { chain: 'Hyperliquid L1' }
        },
        { cacheKey: 'defillama:stablecoins:hyperliquid-l1', ttlMs: config.cacheTtlMs * 5 }
      );
    }
  };
}
