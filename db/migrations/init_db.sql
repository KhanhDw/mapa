-- =====================================================================
-- CLEAN & LEAN DATABASE INITIALIZATION FOR MAPA
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tạo schema nghiệp vụ
CREATE SCHEMA IF NOT EXISTS user_data;

-- 1. Bảng Đường giao thông (nếu cần tra cứu)
CREATE TABLE IF NOT EXISTS public.vietnam_roads (
    id SERIAL PRIMARY KEY,
    name TEXT,
    fclass TEXT,
    geom GEOMETRY(MultiLineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vietnam_roads_geom ON public.vietnam_roads USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_search_roads_name_trgm ON public.vietnam_roads USING gin (name gin_trgm_ops);

CREATE TABLE public.streetview_links (
    source_id integer NOT NULL,
    target_id integer NOT NULL,

    PRIMARY KEY(source_id, target_id),

    CONSTRAINT fk_source
        FOREIGN KEY(source_id)
        REFERENCES public.streetview_images(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_target
        FOREIGN KEY(target_id)
        REFERENCES public.streetview_images(id)
        ON DELETE CASCADE
);

-- 2. Bảng Ảnh Panorama / Street View
CREATE TABLE IF NOT EXISTS public.streetview_images (
    id SERIAL PRIMARY KEY,

    file_path TEXT NOT NULL,

    heading DOUBLE PRECISION DEFAULT 0,
    pitch DOUBLE PRECISION DEFAULT 0,

    -- Liên kết tới các panorama tiếp theo
    next_ids INTEGER[] NOT NULL DEFAULT '{}',

    geom GEOMETRY(Point, 4326) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_streetview_geom ON public.streetview_images USING gist (geom);

CREATE INDEX IF NOT EXISTS idx_streetview_next_ids ON public.streetview_images USING gin (next_ids);

-- 3. Bảng Quản lý Trụ điện (Core feature)
CREATE TABLE IF NOT EXISTS user_data.electric_poles (
    id BIGSERIAL PRIMARY KEY,
    pole_code TEXT NOT NULL UNIQUE,
    route TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'good' CHECK (status IN ('good', 'warning', 'error')),
    detail TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_electric_poles_geom ON user_data.electric_poles USING gist (geom);

-- 4. Bảng POI của người dùng
CREATE TABLE IF NOT EXISTS user_data.pois (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    address TEXT,
    phone TEXT,
    description TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_pois_geom ON user_data.pois USING gist (geom);

-- 5. Bảng Ảnh POI
CREATE TABLE IF NOT EXISTS user_data.poi_photos (
    id BIGSERIAL PRIMARY KEY,
    poi_id BIGINT NOT NULL REFERENCES user_data.pois(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    thumb_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_photos_poi ON user_data.poi_photos (poi_id);

-- Gìn giữ các index tìm kiếm mượt mà bằng trgm
CREATE INDEX IF NOT EXISTS idx_search_user_pois_name_trgm ON user_data.pois USING gin (name gin_trgm_ops);

-- 6. bảng public.pois
CREATE TABLE IF NOT EXISTS public.pois (
    id SERIAL PRIMARY KEY,
    name TEXT,
    fclass TEXT,
    category TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_pois_geom ON public.pois USING gist (geom);