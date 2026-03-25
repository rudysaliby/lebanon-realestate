-- Run this in Supabase SQL Editor to add image support
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Refresh area stats view
REFRESH MATERIALIZED VIEW area_stats;
