# HyperFund

HyperFund is a Node.js terminal dashboard for Hyperliquid fundamentals. It fetches live data from Hyperliquid and DefiLlama, renders a colorized CLI dashboard, and persists daily JSON snapshots for local 7d and 30d trend analysis.

## Commands

```bash
npm start
npm run snapshot
npm run trend
npm run history
```

After linking or installing the package, the executable is available as:

```bash
hyperfund
hyperfund snapshot
hyperfund trend
hyperfund history
```

Snapshots and cache files are stored in `~/.hyperfund` by default. Override this with `--data-dir <path>` or `HYPERFUND_DATA_DIR`.

## Configuration

- `--refresh`: bypass fresh cache and request live data.
- `--no-cache`: disable API caching.
- `--cache-ttl <ms>` or `HYPERFUND_CACHE_TTL_MS`: cache freshness window.
- `--timeout <ms>` or `HYPERFUND_REQUEST_TIMEOUT_MS`: API timeout.
- `--retries <count>` or `HYPERFUND_RETRIES`: transient failure retry count.
- `--aqav2-fee-rate-bps <bps>` or `HYPERFUND_AQAV2_FEE_RATE_BPS`: fee-rate assumption used for AQAv2 revenue estimation.
