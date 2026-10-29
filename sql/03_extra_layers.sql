-- 03_extra_layers.sql
-- Bổ sung 15 layer còn thiếu để đủ 20 bảng raw OSM của bản cũ.
-- Dùng MATERIALIZED VIEW + pattern giống 02_clean.sql (simplify, normalize, GIST).
-- PHẢI chạy SAU 02_clean.sql.

BEGIN;

-- Fail sớm nếu 02 chưa chạy
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tile_reader') THEN
    RAISE EXCEPTION 'Role tile_reader chua ton tai. Chay 02_clean.sql truoc.';
  END IF;
END $$;

-- =========================================================
-- POLYGON
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.water_areas CASCADE;
CREATE MATERIALIZED VIEW clean.water_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0002), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_water_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.landuse CASCADE;
CREATE MATERIALIZED VIEW clean.landuse AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0002), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_landuse_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.places_areas CASCADE;
CREATE MATERIALIZED VIEW clean.places_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0002), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_places_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.natural_areas CASCADE;
CREATE MATERIALIZED VIEW clean.natural_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0002), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_natural_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

-- Buildings: KHÔNG simplify (toà nhà nhỏ, simplify sẽ phá hình dạng)
DROP MATERIALIZED VIEW IF EXISTS clean.buildings CASCADE;
CREATE MATERIALIZED VIEW clean.buildings AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))
           ::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_buildings_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.pois_areas CASCADE;
CREATE MATERIALIZED VIEW clean.pois_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0001), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_pois_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.pofw_areas CASCADE;
CREATE MATERIALIZED VIEW clean.pofw_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0001), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_pofw_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.traffic_areas CASCADE;
CREATE MATERIALIZED VIEW clean.traffic_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0001), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_traffic_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.transport_areas CASCADE;
CREATE MATERIALIZED VIEW clean.transport_areas AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0001), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_transport_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

-- =========================================================
-- LINE
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.railways CASCADE;
CREATE MATERIALIZED VIEW clean.railways AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0001))
           ::geometry(MultiLineString, 4326) AS geom
  FROM raw.gis_osm_railways_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.waterways CASCADE;
CREATE MATERIALIZED VIEW clean.waterways AS
SELECT * FROM (
  SELECT osm_id, fclass,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.00005))
           ::geometry(MultiLineString, 4326) AS geom
  FROM raw.gis_osm_waterways_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s WHERE NOT ST_IsEmpty(geom);

-- =========================================================
-- POINT: ST_Centroid phòng trường hợp raw là polygon (giống cách 02 làm với pois)
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.pofw CASCADE;
CREATE MATERIALIZED VIEW clean.pofw AS
SELECT osm_id, fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       ST_Centroid(geom)::geometry(Point, 4326) AS geom
FROM raw.gis_osm_pofw_free
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  AND NOT ST_IsEmpty(ST_Centroid(geom));

DROP MATERIALIZED VIEW IF EXISTS clean.traffic CASCADE;
CREATE MATERIALIZED VIEW clean.traffic AS
SELECT osm_id, fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       ST_Centroid(geom)::geometry(Point, 4326) AS geom
FROM raw.gis_osm_traffic_free
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  AND NOT ST_IsEmpty(ST_Centroid(geom));

DROP MATERIALIZED VIEW IF EXISTS clean.transport CASCADE;
CREATE MATERIALIZED VIEW clean.transport AS
SELECT osm_id, fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       ST_Centroid(geom)::geometry(Point, 4326) AS geom
FROM raw.gis_osm_transport_free
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  AND NOT ST_IsEmpty(ST_Centroid(geom));

DROP MATERIALIZED VIEW IF EXISTS clean.natural CASCADE;
CREATE MATERIALIZED VIEW clean.natural AS
SELECT osm_id, fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       ST_Centroid(geom)::geometry(Point, 4326) AS geom
FROM raw.gis_osm_natural_free
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  AND NOT ST_IsEmpty(ST_Centroid(geom));

-- =========================================================
-- GIST index cho MỌI matview clean (kể cả 7 view đã có ở 02)
-- =========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT matviewname AS m FROM pg_matviews WHERE schemaname = 'clean' LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON clean.%I USING gist (geom)', r.m || '_geom_idx', r.m);
  END LOOP;
END $$;

-- =========================================================
-- Quyền
-- =========================================================
GRANT USAGE ON SCHEMA clean TO tile_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA clean TO tile_reader;

ANALYZE clean.water_areas;
ANALYZE clean.landuse;
ANALYZE clean.places_areas;
ANALYZE clean.natural_areas;
ANALYZE clean.buildings;
ANALYZE clean.pois_areas;
ANALYZE clean.pofw_areas;
ANALYZE clean.traffic_areas;
ANALYZE clean.transport_areas;
ANALYZE clean.railways;
ANALYZE clean.waterways;
ANALYZE clean.pofw;
ANALYZE clean.traffic;
ANALYZE clean.transport;
ANALYZE clean.natural;

COMMIT;

-- Tóm tắt: đủ 22 layer
SELECT 'admin_areas'     AS layer, count(*) FROM clean.admin_areas
UNION ALL SELECT 'protected_areas', count(*) FROM clean.protected_areas
UNION ALL SELECT 'pois',            count(*) FROM clean.pois
UNION ALL SELECT 'places',          count(*) FROM clean.places
UNION ALL SELECT 'roads_major',     count(*) FROM clean.roads_major
UNION ALL SELECT 'roads_minor',     count(*) FROM clean.roads_minor
UNION ALL SELECT 'roads_local',     count(*) FROM clean.roads_local
UNION ALL SELECT 'water_areas',     count(*) FROM clean.water_areas
UNION ALL SELECT 'landuse',         count(*) FROM clean.landuse
UNION ALL SELECT 'places_areas',    count(*) FROM clean.places_areas
UNION ALL SELECT 'natural_areas',   count(*) FROM clean.natural_areas
UNION ALL SELECT 'buildings',       count(*) FROM clean.buildings
UNION ALL SELECT 'pois_areas',      count(*) FROM clean.pois_areas
UNION ALL SELECT 'pofw_areas',      count(*) FROM clean.pofw_areas
UNION ALL SELECT 'traffic_areas',   count(*) FROM clean.traffic_areas
UNION ALL SELECT 'transport_areas', count(*) FROM clean.transport_areas
UNION ALL SELECT 'railways',        count(*) FROM clean.railways
UNION ALL SELECT 'waterways',       count(*) FROM clean.waterways
UNION ALL SELECT 'pofw',            count(*) FROM clean.pofw
UNION ALL SELECT 'traffic',         count(*) FROM clean.traffic
UNION ALL SELECT 'transport',       count(*) FROM clean.transport
UNION ALL SELECT 'natural',         count(*) FROM clean.natural
ORDER BY layer;