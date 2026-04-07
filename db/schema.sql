-- Lebanon Real Estate MVP - Database Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,
  external_id   TEXT,
  url           TEXT NOT NULL UNIQUE,
  title         TEXT,
  description   TEXT,
  price         NUMERIC,
  currency      TEXT DEFAULT 'USD',
  price_period  TEXT,
  property_type TEXT,
  size_sqm      NUMERIC,
  location_raw  TEXT,
  area          TEXT,
  city          TEXT DEFAULT 'Beirut',
  lat           NUMERIC,
  lng           NUMERIC,
  price_per_sqm NUMERIC GENERATED ALWAYS AS (
    CASE WHEN size_sqm > 0 AND price > 0 THEN ROUND(price / size_sqm, 2) ELSE NULL END
  ) STORED,
  scraped_at    TIMESTAMPTZ DEFAULT now(),
  is_active     BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_listings_area     ON listings(area);
CREATE INDEX IF NOT EXISTS idx_listings_type     ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_price    ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_source   ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_coords   ON listings(lat, lng);
CREATE INDEX IF NOT EXISTS idx_listings_active   ON listings(is_active);

CREATE MATERIALIZED VIEW IF NOT EXISTS area_stats AS
SELECT
  area,
  property_type,
  COUNT(*)                                                    AS listing_count,
  ROUND(AVG(price)::numeric, 0)                              AS avg_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric, 0) AS median_price,
  ROUND(AVG(price_per_sqm)::numeric, 2)                      AS avg_price_per_sqm,
  MIN(price)                                                  AS min_price,
  MAX(price)                                                  AS max_price
FROM listings
WHERE is_active = true AND price IS NOT NULL AND area IS NOT NULL
GROUP BY area, property_type;

-- Refresh materialized view (run after each scrape)
-- REFRESH MATERIALIZED VIEW area_stats;

-- Allow public read access (for frontend)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON listings FOR SELECT USING (true);

-- ============================================================
-- User profiles — stores tier, tokens, and profile info
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  tier       TEXT NOT NULL DEFAULT 'free',
  tokens     INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- Users can read their own profile
CREATE POLICY "Users read own profile"  ON user_profiles FOR SELECT USING (auth.uid() = id);
-- Users can update their own profile (tokens, etc.)
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
-- Allow inserts (for auto-creating profiles on first sign-in)
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- Service role (used by webhooks & admin APIs) bypasses RLS automatically

-- ============================================================
-- Deal alerts — user-created price alerts per area
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area          TEXT NOT NULL,
  region        TEXT,
  max_price     NUMERIC NOT NULL,
  property_type TEXT,
  price_period  TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_alerts_user   ON deal_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_alerts_active ON deal_alerts(active);

ALTER TABLE deal_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own alerts"   ON deal_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alerts" ON deal_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alerts" ON deal_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own alerts" ON deal_alerts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Area benchmarks — admin-set manual price data per area
-- ============================================================
CREATE TABLE IF NOT EXISTS area_benchmarks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area          TEXT NOT NULL,
  region        TEXT,
  type_group    TEXT NOT NULL DEFAULT 'residential',
  price_period  TEXT NOT NULL DEFAULT 'sale',
  median_ppsqm  NUMERIC NOT NULL,
  source        TEXT DEFAULT 'manual',
  notes         TEXT,
  updated_by    UUID REFERENCES auth.users(id),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(area, type_group, price_period)
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_area ON area_benchmarks(area);

ALTER TABLE area_benchmarks ENABLE ROW LEVEL SECURITY;
-- Anyone can read benchmarks (used in valuation)
CREATE POLICY "Public read benchmarks" ON area_benchmarks FOR SELECT USING (true);
-- Only admin (via service role) can insert/update/delete — handled server-side
