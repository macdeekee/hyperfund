export function createHyperliquidClient(config, http) {
  const infoUrl = `${config.hyperliquidBaseUrl}/info`;

  return {
    async getMetaAndAssetContexts() {
      return http.requestJson(
        {
          method: 'POST',
          url: infoUrl,
          headers: { 'content-type': 'application/json' },
          data: { type: 'metaAndAssetCtxs' }
        },
        { cacheKey: 'hyperliquid:metaAndAssetCtxs' }
      );
    },

    async getAllMids() {
      return http.requestJson(
        {
          method: 'POST',
          url: infoUrl,
          headers: { 'content-type': 'application/json' },
          data: { type: 'allMids' }
        },
        { cacheKey: 'hyperliquid:allMids' }
      );
    }
  };
}
