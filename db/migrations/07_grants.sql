-- Grant quyền cho backend API role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streetview_images TO mapa_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_data.pois TO mapa_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_data.poi_photos TO mapa_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_data.electric_poles TO mapa_api;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mapa_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA user_data TO mapa_api;

-- Read-only cho dữ liệu OSM + roads
GRANT SELECT ON clean.pois, clean.places TO mapa_api;
GRANT SELECT ON public.vietnam_roads TO mapa_api;