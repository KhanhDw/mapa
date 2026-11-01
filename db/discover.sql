-- =====================================================================
-- WEBMAP MAPA — DATABASE DISCOVERY v1
-- Mục đích: thu thập toàn bộ metadata để viết DB spec chính xác
-- =====================================================================
\pset pager off
\pset format aligned
\x auto

-- ========== SECTION 1: INFRASTRUCTURE ==========
\echo ''
\echo '========== 1.1 EXTENSIONS =========='
SELECT extname, extversion FROM pg_extension ORDER BY extname;

\echo '========== 1.2 SCHEMAS =========='
SELECT schema_name, schema_owner
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
ORDER BY schema_name;

\echo '========== 1.3 ROLES =========='
SELECT rolname, rolsuper, rolcanlogin, rolcreatedb
FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname;

\echo '========== 1.4 POSTGIS VERSION =========='
SELECT PostGIS_Full_Version();

-- ========== SECTION 2: TABLE INVENTORY ==========
\echo ''
\echo '========== 2.1 ALL TABLES + SIZE =========='
SELECT
    n.nspname AS schema,
    c.relname AS table_name,
    c.reltuples::bigint AS est_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
    c.relkind AS kind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','v','m','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
ORDER BY n.nspname, c.relname;

\echo '========== 2.2 EXACT ROW COUNTS =========='
SELECT 'user_data.pois'        AS tbl, count(*) FROM user_data.pois
UNION ALL SELECT 'user_data.poi_photos',      count(*) FROM user_data.poi_photos
UNION ALL SELECT 'public.pois',                count(*) FROM public.pois
UNION ALL SELECT 'public.streetview_images',   count(*) FROM public.streetview_images
UNION ALL SELECT 'public.vietnam_roads',       count(*) FROM public.vietnam_roads
UNION ALL SELECT 'public.osm_roads',           count(*) FROM public.osm_roads
UNION ALL SELECT 'clean.pois',                 count(*) FROM clean.pois
UNION ALL SELECT 'clean.places',               count(*) FROM clean.places
UNION ALL SELECT 'clean.buildings',            count(*) FROM clean.buildings
UNION ALL SELECT 'clean.water_areas',          count(*) FROM clean.water_areas;

-- ========== SECTION 3: SCHEMA DETAILS ==========
\echo ''
\echo '========== 3.1 user_data.pois =========='
\d+ user_data.pois

\echo '========== 3.2 user_data.poi_photos =========='
\d+ user_data.poi_photos

\echo '========== 3.3 public.pois =========='
\d+ public.pois

\echo '========== 3.4 public.streetview_images =========='
\d+ public.streetview_images

\echo '========== 3.5 public.vietnam_roads =========='
\d+ public.vietnam_roads

\echo '========== 3.6 clean.pois =========='
\d+ clean.pois

-- ========== SECTION 4: CONSTRAINTS & INDEXES ==========
\echo ''
\echo '========== 4.1 CONSTRAINTS =========='
SELECT
    n.nspname AS schema,
    c.relname AS tbl,
    con.conname AS name,
    CASE con.contype
        WHEN 'p' THEN 'PK'
        WHEN 'f' THEN 'FK'
        WHEN 'c' THEN 'CHECK'
        WHEN 'u' THEN 'UNIQUE'
        ELSE con.contype::text
    END AS type,
    pg_get_constraintdef(con.oid) AS def
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('user_data','public','clean')
  AND c.relname IN ('pois','poi_photos','streetview_images','vietnam_roads')
ORDER BY n.nspname, c.relname, con.contype, con.conname;

\echo '========== 4.2 INDEXES =========='
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname IN ('user_data','public','clean')
  AND tablename IN ('pois','poi_photos','streetview_images','vietnam_roads')
ORDER BY schemaname, tablename, indexname;

-- ========== SECTION 5: GEOMETRY METADATA ==========
\echo ''
\echo '========== 5.1 GEOMETRY COLUMNS =========='
SELECT f_table_schema, f_table_name, f_geometry_column,
       coord_dimension, srid, type
FROM geometry_columns
WHERE f_table_schema IN ('user_data','public','clean')
ORDER BY f_table_schema, f_table_name;

-- ========== SECTION 6: SAMPLE DATA ==========
\echo ''
\echo '========== 6.1 user_data.pois (5 newest) =========='
SELECT id, name, category, address, phone, description,
       ST_X(geom)::numeric(10,6) AS lng,
       ST_Y(geom)::numeric(10,6) AS lat,
       created_at
FROM user_data.pois ORDER BY id DESC LIMIT 5;

\echo '========== 6.2 user_data.poi_photos (5 newest) =========='
SELECT id, poi_id, file_path, thumb_path, width, height
FROM user_data.poi_photos ORDER BY id DESC LIMIT 5;

\echo '========== 6.3 public.pois (5 rows) =========='
SELECT * FROM public.pois LIMIT 5;

\echo '========== 6.4 public.streetview_images (5 newest) =========='
SELECT id,
       ST_X(geom)::numeric(10,6) AS lng,
       ST_Y(geom)::numeric(10,6) AS lat,
       image_url, heading, next_ids, link_positions, captured_at
FROM public.streetview_images ORDER BY id DESC LIMIT 5;

\echo '========== 6.5 clean.pois (5 rows) =========='
SELECT * FROM clean.pois LIMIT 5;

-- ========== SECTION 7: DIAGNOSTICS ==========
\echo ''
\echo '========== 7.1 CATEGORIES user_data.pois =========='
SELECT category, count(*) FROM user_data.pois GROUP BY category ORDER BY count(*) DESC;

\echo '========== 7.2 CATEGORIES public.pois (top 50) =========='
SELECT category, count(*) FROM public.pois GROUP BY category ORDER BY count(*) DESC LIMIT 50;

\echo '========== 7.3 CATEGORIES clean.pois (top 50) =========='
SELECT kind, count(*) FROM clean.pois GROUP BY kind ORDER BY count(*) DESC LIMIT 50;

\echo '========== 7.4 GEOMETRY VALIDITY =========='
SELECT 'user_data.pois' AS tbl, count(*) AS invalid FROM user_data.pois WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'public.pois', count(*) FROM public.pois WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'public.streetview_images', count(*) FROM public.streetview_images WHERE NOT ST_IsValid(geom);

\echo '========== 7.5 NULL CHECK user_data.pois =========='
SELECT
    count(*) FILTER (WHERE name IS NULL OR trim(name)='') AS no_name,
    count(*) FILTER (WHERE category IS NULL) AS no_cat,
    count(*) FILTER (WHERE geom IS NULL) AS no_geom,
    count(*) FILTER (WHERE address IS NULL) AS no_addr,
    count(*) AS total
FROM user_data.pois;

\echo '========== 7.6 tile_reader PERMISSIONS =========='
SELECT table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'tile_reader'
  AND table_schema IN ('user_data','public','clean')
ORDER BY table_schema, table_name, privilege_type;

\echo '========== 7.7 EXTRA user_data COLUMNS =========='
SELECT table_name, ordinal_position, column_name, data_type,
       character_maximum_length AS max_len,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'user_data'
ORDER BY table_name, ordinal_position;

\echo '========== 7.8 CUSTOM TYPES/ENUMS =========='
SELECT n.nspname, t.typname,
       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
GROUP BY n.nspname, t.typname;

\echo '========== 7.9 TRIGGERS =========='
SELECT n.nspname AS schema, c.relname AS tbl, tg.tgname,
       pg_get_triggerdef(tg.oid) AS def
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT tg.tgisinternal
  AND n.nspname IN ('user_data','public','clean')
ORDER BY n.nspname, c.relname, tg.tgname;

\echo ''
\echo '========== DONE =========='