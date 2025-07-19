
-- Index de performance pour optimiser les requêtes par région
CREATE INDEX IF NOT EXISTS idx_events_geo_region
  ON events_geo(region_code);
