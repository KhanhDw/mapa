BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vietnam_roads'
      AND indexdef ILIKE '%USING gist (geom)%'
  ) THEN
    RAISE EXCEPTION 'Missing GiST index on public.vietnam_roads(geom)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'streetview_images'
      AND indexdef ILIKE '%USING gist (geom)%'
  ) THEN
    RAISE EXCEPTION 'Missing GiST index on public.streetview_images(geom)';
  END IF;
END
$$;

GRANT SELECT ON TABLE public.vietnam_roads TO tile_reader;
GRANT SELECT ON TABLE public.streetview_images TO tile_reader;

ANALYZE public.vietnam_roads;
ANALYZE public.streetview_images;

COMMIT;
