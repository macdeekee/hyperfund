-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemaVersion" INTEGER NOT NULL,
    "sourceStatus" JSONB NOT NULL,
    "formulas" JSONB NOT NULL,
    "raw" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "price" REAL,
    "marketCap" REAL,
    "annualizedRevenue" REAL,
    "revenue24h" REAL,
    "revenue7d" REAL,
    "revenue30d" REAL,
    "fees24h" REAL,
    "buybacks24h" REAL,
    "buybacksAnnualized" REAL,
    "stablecoinMarketCap" REAL,
    "aqav2DailyRevenue" REAL,
    "aqav2AnnualizedRevenue" REAL,
    "totalOpenInterestUsd" REAL,
    "totalPerpVolume24h" REAL,
    "hypeOpenInterestUsd" REAL,
    "hypePerpVolume24h" REAL,
    "tvl" REAL,
    "activePerpMarkets" INTEGER,
    "revenueMultiple" REAL,
    "buybackYield" REAL,
    "stablecoinToMarketCap" REAL,
    "volumeToMarketCap" REAL,
    "weightedScore" REAL,
    "scoreRating" TEXT,
    CONSTRAINT "MetricSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "score" REAL NOT NULL,
    CONSTRAINT "ScoreComponent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValuationScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "multiple" REAL NOT NULL,
    "impliedMarketCap" REAL,
    "impliedPrice" REAL,
    "upside" REAL,
    CONSTRAINT "ValuationScenario_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "currentPrice" REAL,
    "fairBear" REAL,
    "fairBase" REAL,
    "fairBull" REAL,
    "bearUpside" REAL,
    "baseUpside" REAL,
    "bullUpside" REAL,
    "signal" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Forecast_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forecastId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "impact" REAL NOT NULL,
    "value" REAL,
    "detail" TEXT NOT NULL,
    CONSTRAINT "ForecastDriver_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_date_key" ON "Snapshot"("date");

-- CreateIndex
CREATE INDEX "Snapshot_capturedAt_idx" ON "Snapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_snapshotId_key" ON "MetricSnapshot"("snapshotId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_weightedScore_idx" ON "MetricSnapshot"("weightedScore");

-- CreateIndex
CREATE INDEX "ScoreComponent_snapshotId_idx" ON "ScoreComponent"("snapshotId");

-- CreateIndex
CREATE INDEX "ValuationScenario_snapshotId_idx" ON "ValuationScenario"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_snapshotId_key" ON "Forecast"("snapshotId");

-- CreateIndex
CREATE INDEX "ForecastDriver_forecastId_idx" ON "ForecastDriver"("forecastId");
