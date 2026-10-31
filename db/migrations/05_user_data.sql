-- db/migrations/05_user_data.sql
-- Chạy bằng tài khoản postgres. Chạy lại nhiều lần không lỗi (idempotent).
-- Tạo schema user_data (tile_reader KHÔNG có quyền -> pg_tileserv không công bố)
-- và role mapa_api cho backend.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mapa_api') THEN
    CREATE ROLE mapa_api LOGIN PASSWORD 'mapa_api_dev';  -- DEV: đổi khi triển khai thật
  END IF;
END
$$;

GRANT CONNECT ON DATABASE webmap_db TO mapa_api;

CREATE SCHEMA IF NOT EXISTS user_data;

CREATE TABLE IF NOT EXISTS user_data.pois (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  address     TEXT,
  phone       TEXT,
  description TEXT,
  geom        geometry(Point, 4326) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_pois_geom     ON user_data.pois USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_user_pois_category ON user_data.pois (category);

CREATE TABLE IF NOT EXISTS user_data.poi_photos (
  id         BIGSERIAL PRIMARY KEY,
  poi_id     BIGINT NOT NULL REFERENCES user_data.pois(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,
  thumb_path TEXT,
  width      INT,
  height     INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_photos_poi ON user_data.poi_photos (poi_id);

-- Quyền cho mapa_api
GRANT USAGE ON SCHEMA public, user_data TO mapa_api;
GRANT SELECT ON public.vietnam_roads, public.pois, public.streetview_images TO mapa_api;
-- Ảnh 360 do người dùng thêm ghi thẳng vào streetview_images (như các script PowerShell hiện tại)
GRANT INSERT ON public.streetview_images TO mapa_api;
GRANT USAGE, SELECT ON SEQUENCE public.streetview_images_id_seq TO mapa_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_data.pois, user_data.poi_photos TO mapa_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA user_data TO mapa_api;

COMMIT;