-- =====================================================================
-- MAPA — CLEAN DB INIT (dependency-ordered)
-- Re-runnable: mọi CREATE/ADD/INDEX/TRIGGER đều idempotent
-- =====================================================================

-- ============ 0. EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;         -- soundex/metaphone cho fuzzy match
CREATE EXTENSION IF NOT EXISTS postgis_topology;      -- schema topology.*
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;-- schema tiger.*

CREATE SCHEMA IF NOT EXISTS user_data;

-- ============ 1. HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============ 2. PUBLIC: STATIC / IMPORTED DATA ============

-- 2.1 Đường giao thông
CREATE TABLE IF NOT EXISTS public.vietnam_roads (
    id      SERIAL PRIMARY KEY,
    name    TEXT,
    fclass  TEXT,
    geom    GEOMETRY(MultiLineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vietnam_roads_geom
    ON public.vietnam_roads USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_search_roads_name_trgm
    ON public.vietnam_roads USING gin (name gin_trgm_ops);

-- 2.2 POI công khai (import OSM/OSV)
CREATE TABLE IF NOT EXISTS public.pois (
    id        SERIAL PRIMARY KEY,
    name      TEXT,
    fclass    TEXT,
    category  TEXT,
    geom      GEOMETRY(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_pois_geom
    ON public.pois USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_public_pois_name_trgm
    ON public.pois USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_public_pois_category
    ON public.pois (category);

-- ============ 3. PUBLIC: USERS ============
-- Phải đứng trước streetview_images & electric_poles (FK user_id).
CREATE TABLE IF NOT EXISTS public.users (
    id                BIGSERIAL PRIMARY KEY,
    username          CITEXT       NOT NULL UNIQUE,
    email             CITEXT       NOT NULL UNIQUE,
    password_hash     TEXT         NOT NULL,
    display_name      VARCHAR(100),
    role              TEXT         NOT NULL DEFAULT 'user'
                                   CHECK (role IN ('user','moderator','admin')),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Phòng thủ idempotent cho DB đã tồn tại (no-op trên DB trắng).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role              TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_role_active
    ON public.users (role) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_last_login
    ON public.users (last_login_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. PUBLIC: STREETVIEW GRAPH ============

-- 4.1 Ảnh panorama (yêu cầu chủ sở hữu)
CREATE TABLE IF NOT EXISTS public.streetview_images (
    id          SERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL
                REFERENCES public.users(id) ON DELETE RESTRICT,
    file_path   TEXT NOT NULL,
    heading     DOUBLE PRECISION DEFAULT 0,
    pitch       DOUBLE PRECISION DEFAULT 0,
    next_ids    INTEGER[] NOT NULL DEFAULT '{}',   -- denormalized
    geom        GEOMETRY(Point, 4326) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_streetview_geom
    ON public.streetview_images USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_streetview_next_ids
    ON public.streetview_images USING gin (next_ids);
CREATE INDEX IF NOT EXISTS idx_streetview_user_id
    ON public.streetview_images (user_id);

-- 4.2 Cạnh đồ thị (normalized) — PHẢI sau streetview_images
CREATE TABLE IF NOT EXISTS public.streetview_links (
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    PRIMARY KEY (source_id, target_id),
    CONSTRAINT fk_streetview_source
        FOREIGN KEY (source_id) REFERENCES public.streetview_images(id) ON DELETE CASCADE,
    CONSTRAINT fk_streetview_target
        FOREIGN KEY (target_id) REFERENCES public.streetview_images(id) ON DELETE CASCADE,
    CONSTRAINT chk_no_self_loop CHECK (source_id <> target_id)
);
CREATE INDEX IF NOT EXISTS idx_streetview_links_target
    ON public.streetview_links (target_id);   -- tăng tốc reverse traversal

-- ============ 5. USER_DATA: ADMIN UNITS ============
-- Giữ TEXT khớp snapshot hiện tại; migration số hoá xem mục 10
CREATE TABLE IF NOT EXISTS user_data.vietnam_wards_2025 (
    ma           TEXT,
    cay          TEXT,
    ma1          TEXT,
    khoa         TEXT,
    loai         TEXT,
    vido         TEXT,
    tenhc        TEXT,
    kinhdo       TEXT,
    matinh       TEXT,
    tentinh      TEXT,
    matinhxa     TEXT,
    dansonguoi   TEXT,
    trungtamhc   TEXT,
    dientichkm2  TEXT,
    truocsapnhap TEXT,
    area         TEXT,
    geom         GEOMETRY(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS idx_vietnam_wards_2025_geom
    ON user_data.vietnam_wards_2025 USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_vietnam_wards_2025_ma
    ON user_data.vietnam_wards_2025 (ma);
CREATE INDEX IF NOT EXISTS idx_vietnam_wards_2025_matinh
    ON user_data.vietnam_wards_2025 (matinh);
CREATE INDEX IF NOT EXISTS idx_vietnam_wards_2025_tenhc_trgm
    ON user_data.vietnam_wards_2025 USING gin (tenhc gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vietnam_wards_2025_tentinh_trgm
    ON user_data.vietnam_wards_2025 USING gin (tentinh gin_trgm_ops);

-- ============ 6. USER_DATA: ELECTRIC POLES ============
CREATE TABLE IF NOT EXISTS user_data.electric_poles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL
                REFERENCES public.users(id) ON DELETE RESTRICT,
    pole_code   TEXT NOT NULL UNIQUE,
    route       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'good'
                CHECK (status IN ('good','warning','error')),
    detail      TEXT,
    geom        GEOMETRY(Point, 4326) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_electric_poles_geom
    ON user_data.electric_poles USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_electric_poles_route
    ON user_data.electric_poles (route);
CREATE INDEX IF NOT EXISTS idx_electric_poles_status
    ON user_data.electric_poles (status);
CREATE INDEX IF NOT EXISTS idx_electric_poles_user_id
    ON user_data.electric_poles (user_id);

DROP TRIGGER IF EXISTS trg_electric_poles_updated_at ON user_data.electric_poles;
CREATE TRIGGER trg_electric_poles_updated_at
    BEFORE UPDATE ON user_data.electric_poles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 7. USER_DATA: USER POIs + PHOTOS ============
-- user_id nullable + SET NULL: khi user bị xoá, POI giữ lại thuộc về hệ thống
-- (policy xử lý ở migration riêng — xem mục 10).
CREATE TABLE IF NOT EXISTS user_data.pois (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL
                REFERENCES public.users(id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'other',
    address     TEXT,
    phone       TEXT,
    description TEXT,
    geom        GEOMETRY(Point, 4326) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE user_data.pois
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_pois_geom
    ON user_data.pois USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_user_pois_user_id
    ON user_data.pois (user_id);
CREATE INDEX IF NOT EXISTS idx_user_pois_category
    ON user_data.pois (category);
CREATE INDEX IF NOT EXISTS idx_search_user_pois_name_trgm
    ON user_data.pois USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS user_data.poi_photos (
    id          BIGSERIAL PRIMARY KEY,
    poi_id      BIGINT NOT NULL
                REFERENCES user_data.pois(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    thumb_path  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_photos_poi
    ON user_data.poi_photos (poi_id);

-- ============ 8. ĐỒNG BỘ next_ids <-> streetview_links (OPTIONAL) ============
-- Mặc định KHÔNG bật trigger. Bật khi thống nhất single source of truth.

CREATE OR REPLACE FUNCTION public.sync_next_ids_from_links()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.streetview_images
           SET next_ids = (
               SELECT COALESCE(array_agg(target_id ORDER BY target_id), '{}')
               FROM public.streetview_links
               WHERE source_id = NEW.source_id
           )
         WHERE id = NEW.source_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.streetview_images
           SET next_ids = (
               SELECT COALESCE(array_agg(target_id ORDER BY target_id), '{}')
               FROM public.streetview_links
               WHERE source_id = OLD.source_id
           )
         WHERE id = OLD.source_id;
    END IF;
    RETURN NULL;
END;
$$;

-- Bật khi sẵn sàng:
-- DROP TRIGGER IF EXISTS trg_sync_next_ids ON public.streetview_links;
-- CREATE TRIGGER trg_sync_next_ids
--     AFTER INSERT OR DELETE ON public.streetview_links
--     FOR EACH ROW EXECUTE FUNCTION public.sync_next_ids_from_links();

-- ============ 9. SƠ ĐỒ QUAN HỆ ============
/*
public.users             1 ──── N user_data.pois          (user_id, SET NULL)
public.users             1 ──── N user_data.electric_poles(user_id, RESTRICT)
public.users             1 ──── N public.streetview_images(user_id, RESTRICT)

user_data.pois           1 ──── N user_data.poi_photos    (poi_id, CASCADE)

public.streetview_images 1 ──── N public.streetview_links (source_id, CASCADE)
                         1 ──── N public.streetview_links (target_id, CASCADE)

public.vietnam_roads, public.pois,
user_data.vietnam_wards_2025 — dữ liệu hệ thống, độc lập.
*/

-- ============ 10. MIGRATION KHUYẾN NGHỊ (chạy riêng, không trong init) ============
/*
-- Chuyển cột text -> numeric khi đã sẵn sàng (đổi import pipeline trước)
ALTER TABLE user_data.vietnam_wards_2025
    ALTER COLUMN vido        TYPE NUMERIC(10,7) USING NULLIF(vido,'')::numeric,
    ALTER COLUMN kinhdo      TYPE NUMERIC(10,7) USING NULLIF(kinhdo,'')::numeric,
    ALTER COLUMN dansonguoi  TYPE BIGINT         USING NULLIF(dansonguoi,'')::bigint,
    ALTER COLUMN dientichkm2 TYPE NUMERIC(12,4)  USING NULLIF(dientichkm2,'')::numeric,
    ALTER COLUMN area        TYPE NUMERIC(12,4)  USING NULLIF(area,'')::numeric;

ALTER TABLE user_data.vietnam_wards_2025
    ADD COLUMN geom_point GEOMETRY(Point, 4326)
    GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(kinhdo::float8, vido::float8), 4326)
    ) STORED;
CREATE INDEX ON user_data.vietnam_wards_2025 USING gist (geom_point);
*/  