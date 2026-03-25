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
