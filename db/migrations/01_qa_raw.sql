-- 01_qa_raw.sql
-- Báo cáo chất lượng dữ liệu thô trong schema "raw".
-- Chỉ đọc dữ liệu, không sửa gì. Kết quả nằm ở bảng qa.report.

CREATE SCHEMA IF NOT EXISTS qa;
DROP TABLE IF EXISTS qa.report;
CREATE TABLE qa.report (
  table_name   text PRIMARY KEY,
  total        bigint,   -- tổng số bản ghi
  null_geom    bigint,   -- không có hình học
  empty_geom   bigint,   -- hình học rỗng
  invalid_geom bigint,   -- hình học lỗi (tự cắt, vòng hở...)
  no_name      bigint,   -- thiếu tên
  dup_osm_id   bigint    -- số bản ghi dư theo osm_id (chỉ để tham khảo)
);

DO $$
DECLARE
  r record;
  has_name boolean;
  has_osm  boolean;
  tpl constant text := $q$
    INSERT INTO qa.report
    SELECT '{T}', count(*),
           count(*) FILTER (WHERE {G} IS NULL),
           count(*) FILTER (WHERE {G} IS NOT NULL AND ST_IsEmpty({G})),
           count(*) FILTER (WHERE {G} IS NOT NULL AND NOT ST_IsEmpty({G}) AND NOT ST_IsValid({G})),
           {NONAME},
           {DUP}
    FROM raw.{T}
  $q$;
  q text;
BEGIN
  FOR r IN
    SELECT f_table_name AS t, f_geometry_column AS g
    FROM geometry_columns
    WHERE f_table_schema = 'raw'
    ORDER BY 1
  LOOP
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'raw' AND table_name = r.t AND column_name = 'name')
      INTO has_name;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'raw' AND table_name = r.t AND column_name = 'osm_id')
      INTO has_osm;

    q := replace(tpl, '{T}', quote_ident(r.t));
    q := replace(q, '{G}', quote_ident(r.g));
    q := replace(q, '{NONAME}',
           CASE WHEN has_name THEN 'count(*) FILTER (WHERE name IS NULL OR btrim(name) = '''')' ELSE '0' END);
    q := replace(q, '{DUP}',
           CASE WHEN has_osm THEN 'count(*) - count(DISTINCT osm_id)' ELSE '0' END);
    EXECUTE q;
  END LOOP;
END $$;

SELECT * FROM qa.report ORDER BY table_name;

-- Phân bố loại của lớp hành chính (để biết fclass thực tế, dùng cho cột "level" trong 02_clean.sql)
SELECT fclass, count(*) AS n
FROM raw.gis_osm_adminareas_a_free
GROUP BY fclass
ORDER BY n DESC;