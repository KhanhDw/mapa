-- =====================================================================
-- WEBMAP MAPA — DATABASE DISCOVERY v2
-- Mục đích: thu thập toàn bộ metadata để viết DB spec chính xác
-- Cập nhật: đồng bộ với schema thực tế (user_data & public)
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
SELECT 'user_data.pois'               AS tbl, count(*) FROM user_data.pois
UNION ALL SELECT 'user_data.poi_photos',         count(*) FROM user_data.poi_photos
UNION ALL SELECT 'user_data.electric_poles',     count(*) FROM user_data.electric_poles
UNION ALL SELECT 'user_data.vietnam_wards_2025', count(*) FROM user_data.vietnam_wards_2025
UNION ALL SELECT 'public.pois',                  count(*) FROM public.pois
UNION ALL SELECT 'public.streetview_images',     count(*) FROM public.streetview_images
UNION ALL SELECT 'public.vietnam_roads',         count(*) FROM public.vietnam_roads;

-- ========== SECTION 3: SCHEMA DETAILS ==========
\echo ''
\echo '========== 3.1 user_data.pois =========='
\d+ user_data.pois

\echo '========== 3.2 user_data.poi_photos =========='
\d+ user_data.poi_photos

\echo '========== 3.3 user_data.electric_poles =========='
\d+ user_data.electric_poles

\echo '========== 3.4 user_data.vietnam_wards_2025 =========='
\d+ user_data.vietnam_wards_2025

\echo '========== 3.5 public.pois =========='
\d+ public.pois

\echo '========== 3.6 public.streetview_images =========='
\d+ public.streetview_images

\echo '========== 3.7 public.vietnam_roads =========='
\d+ public.vietnam_roads

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
WHERE n.nspname IN ('user_data','public')
  AND c.relname IN ('pois','poi_photos','electric_poles','vietnam_wards_2025','streetview_images','vietnam_roads')
ORDER BY n.nspname, c.relname, con.contype, con.conname;

\echo '========== 4.2 INDEXES =========='
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname IN ('user_data','public')
  AND tablename IN ('pois','poi_photos','electric_poles','vietnam_wards_2025','streetview_images','vietnam_roads')
ORDER BY schemaname, tablename, indexname;

-- ========== SECTION 5: GEOMETRY METADATA ==========
\echo ''
\echo '========== 5.1 GEOMETRY COLUMNS =========='
SELECT f_table_schema, f_table_name, f_geometry_column,
       coord_dimension, srid, type
FROM geometry_columns
WHERE f_table_schema IN ('user_data','public')
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
SELECT id, poi_id, file_path, thumb_path, created_at
FROM user_data.poi_photos ORDER BY id DESC LIMIT 5;

\echo '========== 6.3 user_data.electric_poles (5 newest) =========='
SELECT id, pole_code, route, status, detail,
       ST_X(geom)::numeric(10,6) AS lng,
       ST_Y(geom)::numeric(10,6) AS lat,
       created_at, updated_at
FROM user_data.electric_poles ORDER BY id DESC LIMIT 5;

\echo '========== 6.4 user_data.vietnam_wards_2025 (5 rows) =========='
SELECT ma, tenhc, loai, tentinh, dansonguoi, dientichkm2, kinhdo, vido
FROM user_data.vietnam_wards_2025 LIMIT 5;

\echo '========== 6.5 public.pois (5 rows) =========='
SELECT id, name, fclass, category,
       ST_X(geom)::numeric(10,6) AS lng,
       ST_Y(geom)::numeric(10,6) AS lat
FROM public.pois LIMIT 5;

\echo '========== 6.6 public.streetview_images (5 newest) =========='
SELECT id,
       ST_X(geom)::numeric(10,6) AS lng,
       ST_Y(geom)::numeric(10,6) AS lat,
       file_path, heading, pitch, created_at
FROM public.streetview_images ORDER BY id DESC LIMIT 5;

-- ========== SECTION 7: DIAGNOSTICS ==========
\echo ''
\echo '========== 7.1 CATEGORIES user_data.pois =========='
SELECT category, count(*) FROM user_data.pois GROUP BY category ORDER BY count(*) DESC;

\echo '========== 7.2 CATEGORIES public.pois (top 50) =========='
SELECT category, count(*) FROM public.pois GROUP BY category ORDER BY count(*) DESC LIMIT 50;

\echo '========== 7.3 STATUS user_data.electric_poles =========='
SELECT status, count(*) FROM user_data.electric_poles GROUP BY status ORDER BY count(*) DESC;

\echo '========== 7.4 GEOMETRY VALIDITY =========='
SELECT 'user_data.pois' AS tbl, count(*) AS invalid FROM user_data.pois WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'user_data.electric_poles', count(*) FROM user_data.electric_poles WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'user_data.vietnam_wards_2025', count(*) FROM user_data.vietnam_wards_2025 WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'public.pois', count(*) FROM public.pois WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'public.streetview_images', count(*) FROM public.streetview_images WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'public.vietnam_roads', count(*) FROM public.vietnam_roads WHERE NOT ST_IsValid(geom);

\echo '========== 7.5 NULL CHECK user_data.pois =========='
SELECT
    count(*) FILTER (WHERE name IS NULL OR trim(name)='') AS no_name,
    count(*) FILTER (WHERE category IS NULL) AS no_cat,
    count(*) FILTER (WHERE geom IS NULL) AS no_geom,
    count(*) FILTER (WHERE address IS NULL) AS no_addr,
    count(*) AS total
FROM user_data.pois;

\echo '========== 7.6 NULL CHECK user_data.electric_poles =========='
SELECT
    count(*) FILTER (WHERE pole_code IS NULL OR trim(pole_code)='') AS no_code,
    count(*) FILTER (WHERE route IS NULL OR trim(route)='') AS no_route,
    count(*) FILTER (WHERE geom IS NULL) AS no_geom,
    count(*) AS total
FROM user_data.electric_poles;

\echo '========== 7.7 ROLE PERMISSIONS (non-postgres) =========='
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee NOT IN ('postgres', 'PUBLIC')
  AND table_schema IN ('user_data','public')
ORDER BY grantee, table_schema, table_name, privilege_type;

\echo '========== 7.8 ALL user_data & public COLUMNS =========='
SELECT table_schema, table_name, ordinal_position, column_name, data_type,
       character_maximum_length AS max_len,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('user_data', 'public')
  AND table_name NOT IN ('geography_columns', 'geometry_columns', 'spatial_ref_sys')
ORDER BY table_schema, table_name, ordinal_position;

\echo '========== 7.9 CUSTOM TYPES/ENUMS =========='
SELECT n.nspname, t.typname,
       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
GROUP BY n.nspname, t.typname;

\echo '========== 7.10 TRIGGERS =========='
SELECT n.nspname AS schema, c.relname AS tbl, tg.tgname,
       pg_get_triggerdef(tg.oid) AS def
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT tg.tgisinternal
  AND n.nspname IN ('user_data','public')
ORDER BY n.nspname, c.relname, tg.tgname;

\echo ''
\echo '========== DONE =========='
