-- 02_clean.sql
-- Tạo schema "clean" từ dữ liệu thô "raw". Chạy với: psql -v tilepw=MAT_KHAU ...
-- Giả định: hình học là EPSG:4326, cột hình học tên "geom" (do rebuild.ps1 nạp).

CREATE SCHEMA IF NOT EXISTS clean;

-- Role chỉ đọc cho pg_tileserv
SELECT format('CREATE ROLE tile_reader LOGIN PASSWORD %L', :'tilepw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tile_reader')
\gexec
SELECT format('ALTER ROLE tile_reader PASSWORD %L', :'tilepw')
\gexec

-- =========================================================
-- 1. HÀNH CHÍNH
--    level: lấy số trong fclass (vd "admin_level4" -> 4). Kiểm tra kết quả ở
--    báo cáo 01_qa_raw.sql; nếu fclass không chứa số thì level sẽ là NULL.
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.admin_areas CASCADE;
CREATE MATERIALIZED VIEW clean.admin_areas AS
SELECT * FROM (
  SELECT osm_id,
         fclass,
         NULLIF(regexp_replace(coalesce(fclass, ''), '\D', '', 'g'), '')::int AS level,
         normalize(NULLIF(btrim(name), ''), NFC) AS name,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0003), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_adminareas_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s
WHERE NOT ST_IsEmpty(geom);

-- =========================================================
-- 2. KHU BẢO TỒN
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.protected_areas CASCADE;
CREATE MATERIALIZED VIEW clean.protected_areas AS
SELECT * FROM (
  SELECT osm_id,
         fclass,
         ST_Multi(ST_CollectionExtract(
           ST_SimplifyPreserveTopology(ST_MakeValid(geom), 0.0002), 3
         ))::geometry(MultiPolygon, 4326) AS geom
  FROM raw.gis_osm_protected_areas_a_free
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
) s
WHERE NOT ST_IsEmpty(geom);

-- =========================================================
-- 3. POI: bỏ trùng osm_id, chuẩn hóa tên, gom nhóm theo nghiệp vụ
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.pois CASCADE;
CREATE MATERIALIZED VIEW clean.pois AS
SELECT DISTINCT ON (osm_id, geom)
       osm_id,
       fclass,
       CASE
         WHEN fclass IN ('restaurant','fast_food','cafe','pub','bar','food_court','biergarten')
           THEN 'an_uong'
         WHEN fclass IN ('hospital','clinic','doctors','pharmacy','dentist','veterinary','nursing_home')
           THEN 'y_te'
         WHEN fclass IN ('school','university','college','kindergarten','library')
           THEN 'giao_duc'
         WHEN fclass IN ('bank','atm')
           THEN 'tai_chinh'
         WHEN fclass IN ('supermarket','bakery','mall','department_store','convenience','clothes',
                         'greengrocer','butcher','kiosk','market_place','bookshop','shoe_shop',
                         'furniture_shop','jeweller','mobile_phone_shop','hairdresser','beauty_shop')
           THEN 'mua_sam'
         WHEN fclass IN ('hotel','guesthouse','hostel','motel','chalet','camp_site','caravan_site',
                         'attraction','museum','zoo','theme_park','viewpoint','monument','memorial',
                         'ruins','castle','tourist_info','artwork','picnic_site','archaeological')
           THEN 'du_lich'
         WHEN fclass IN ('police','fire_station','post_office','town_hall','courthouse','embassy',
                         'prison','community_centre','public_building')
           THEN 'hanh_chinh'
         ELSE 'khac'
       END AS category,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       (name IS NOT NULL AND btrim(name) <> '') AS has_name,
       ST_Centroid(geom)::geometry(Point, 4326) AS geom
FROM raw.gis_osm_pois_free
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
ORDER BY osm_id, geom;

-- =========================================================
-- 4. ĐỊA DANH: bỏ bản ghi không tên; minzoom để lọc nhãn theo cấp
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.places CASCADE;
CREATE MATERIALIZED VIEW clean.places AS
SELECT osm_id,
       fclass,
       normalize(btrim(name), NFC) AS name,
       population,
       CASE fclass
         WHEN 'national_capital' THEN 3
         WHEN 'city'    THEN 5
         WHEN 'town'    THEN 8
         WHEN 'island'  THEN 8
         WHEN 'suburb'  THEN 11
         WHEN 'village' THEN 11
         ELSE 13
       END AS minzoom,
       ST_Centroid(geom)::geometry(Point, 4326) AS geom
FROM raw.gis_osm_places_free
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  AND name IS NOT NULL AND btrim(name) <> '';

-- =========================================================
-- 5. ĐƯỜNG: 3 tầng, dùng khi cần popup thuộc tính (bản đồ nền đã có nét vẽ)
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS clean.roads_major CASCADE;
CREATE MATERIALIZED VIEW clean.roads_major AS
SELECT osm_id,
       regexp_replace(fclass, '_link$', '') AS fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       NULLIF(btrim(ref), '') AS ref,
       oneway, bridge, tunnel,
       ST_Multi(ST_SimplifyPreserveTopology(geom, 0.0003))::geometry(MultiLineString, 4326) AS geom
FROM raw.gis_osm_roads_free
WHERE fclass IN ('motorway','motorway_link','trunk','trunk_link',
                 'primary','primary_link','secondary','secondary_link')
  AND geom IS NOT NULL AND NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.roads_minor CASCADE;
CREATE MATERIALIZED VIEW clean.roads_minor AS
SELECT osm_id, fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       NULLIF(btrim(ref), '') AS ref,
       oneway, bridge, tunnel,
       ST_Multi(ST_SimplifyPreserveTopology(geom, 0.00005))::geometry(MultiLineString, 4326) AS geom
FROM raw.gis_osm_roads_free
WHERE fclass IN ('tertiary','tertiary_link','unclassified','residential','living_street')
  AND geom IS NOT NULL AND NOT ST_IsEmpty(geom);

DROP MATERIALIZED VIEW IF EXISTS clean.roads_local CASCADE;
CREATE MATERIALIZED VIEW clean.roads_local AS
SELECT osm_id, fclass,
       normalize(NULLIF(btrim(name), ''), NFC) AS name,
       oneway, bridge, tunnel,
       ST_Multi(geom)::geometry(MultiLineString, 4326) AS geom
FROM raw.gis_osm_roads_free
WHERE fclass IN ('service','track','track_grade1','track_grade2','track_grade3','track_grade4',
                 'track_grade5','path','footway','pedestrian','cycleway','bridleway','steps')
  AND geom IS NOT NULL AND NOT ST_IsEmpty(geom);

-- =========================================================
-- Chỉ mục không gian cho mọi view
-- =========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT matviewname AS m FROM pg_matviews WHERE schemaname = 'clean' LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON clean.%I USING gist (geom)', r.m || '_geom_idx', r.m);
  END LOOP;
END $$;

-- Làm mới tất cả sau khi nạp lại dữ liệu thô:  CALL clean.refresh_all();
CREATE OR REPLACE PROCEDURE clean.refresh_all() LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT matviewname AS m FROM pg_matviews WHERE schemaname = 'clean' LOOP
    EXECUTE format('REFRESH MATERIALIZED VIEW clean.%I', r.m);
  END LOOP;
END $$;

-- =========================================================
-- Quyền: pg_tileserv chỉ thấy schema clean
-- =========================================================
GRANT USAGE ON SCHEMA clean TO tile_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA clean TO tile_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA clean GRANT SELECT ON TABLES TO tile_reader;

ANALYZE;

-- Tóm tắt: số bản ghi sau khi làm sạch
SELECT 'admin_areas'     AS layer, count(*) FROM clean.admin_areas
UNION ALL SELECT 'protected_areas', count(*) FROM clean.protected_areas
UNION ALL SELECT 'pois',            count(*) FROM clean.pois
UNION ALL SELECT 'places',          count(*) FROM clean.places
UNION ALL SELECT 'roads_major',     count(*) FROM clean.roads_major
UNION ALL SELECT 'roads_minor',     count(*) FROM clean.roads_minor
UNION ALL SELECT 'roads_local',     count(*) FROM clean.roads_local;