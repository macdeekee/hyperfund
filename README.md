# HyperFund

HyperFund is a Next.js financial dashboard and Node.js CLI for Hyperliquid fundamentals. It fetches live Hyperliquid and DefiLlama data, stores normalized observations in SQLite through Prisma, and generates valuation, growth, capital-return, and protocol-adoption analysis.

The goal is to answer what Hyperliquid is worth, not only what HYPE is doing.

## Web App

```bash
cp .env.example .env
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`, or use another port with:

```bash
npx next dev --hostname 127.0.0.1 --port 3020
```

Production:

```bash
npm run build
npm start
```

## Database

The initial datastore is SQLite at `prisma/dev.db`.

Terminal trend history is also persisted at `data/snapshots.json` using this shape:

```ts
interface Snapshot {
  timestamp: number;
  revenue: number | null;
  buybacks: number | null;
  stablecoins: number | null;
  openInterest: number | null;
  volume: number | null;
  marketCap: number | null;
}
```

To move to Postgres later:

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
2. Set `DATABASE_URL` to a Postgres connection string.
3. Swap the runtime adapter in `app/lib/db.ts` to `@prisma/adapter-pg`.
4. Run a new Prisma migration.

## CLI

```bash
npm run cli
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

CLI snapshots and cache files are stored in `~/.hyperfund` by default. Override this with `--data-dir <path>` or `HYPERFUND_DATA_DIR`.

## Configuration

- `--refresh`: bypass fresh cache and request live data.
- `--no-cache`: disable API caching.
- `--cache-ttl <ms>` or `HYPERFUND_CACHE_TTL_MS`: cache freshness window.
- `--timeout <ms>` or `HYPERFUND_REQUEST_TIMEOUT_MS`: API timeout.
- `--retries <count>` or `HYPERFUND_RETRIES`: transient failure retry count.
- `--aqav2-fee-rate-bps <bps>` or `HYPERFUND_AQAV2_FEE_RATE_BPS`: fee-rate assumption used for AQAv2 revenue estimation.

## Model

The app stores raw snapshots plus normalized metrics, score components, valuation scenarios, and forecast drivers. The platform now includes:

- Growth Engine: revenue, buyback, stablecoin, open-interest, and volume acceleration.
- Buyback Velocity: annual HYPE absorption, absorption rate, and days to buy 1% of supply.
- AQAv2 Scenario Engine: bear/base/bull incremental revenue and implied HYPE price.
- Revenue Yield Analysis: Hyperliquid vs Coinbase, Nasdaq, and CME benchmark yields.
- Enhanced Fundamental Health: graded revenue, buyback, growth, valuation, liquidity, and overall scores.
- Fair Value Engine: one-year growth, terminal multiple, discount-rate, and current-price discount model.
- Signal Engine: research signals for accelerating fundamentals and risk flags.

Core typed modules live under `src/services`, `src/models`, `src/signals`, and `src/config`.

This is a valuation model, not investment advice.
