-- init/01-pois.sql
CREATE TABLE IF NOT EXISTS pois (
    id          BIGSERIAL PRIMARY KEY,
    osm_id      TEXT UNIQUE,
    name        TEXT,
    category    TEXT,
    geom        GEOMETRY(Point, 4326) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pois_geom     ON pois USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_pois_category ON pois (category);

-- Cấp quyền đọc cho tile_reader (nếu sau này muốn tileserv cũng phục vụ POI)
-- GRANT SELECT ON pois TO tile_reader;