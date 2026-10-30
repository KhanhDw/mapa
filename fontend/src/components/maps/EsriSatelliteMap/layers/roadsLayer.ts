import type { Map as MapLibreMap } from "maplibre-gl";
import { TILE_BASE } from "../../../../config";
import { ROADS_LAYER_ID, ROADS_SOURCE_ID } from "../constants";

/** Thêm source + layer đường từ PostGIS (vector tiles). */
export function addRoadsLayer(map: MapLibreMap): void {
    map.addSource(ROADS_SOURCE_ID, {
        type: "vector",
        tiles: [`${TILE_BASE}/public.vietnam_roads/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 14,
    });

    map.addLayer({
        id: ROADS_LAYER_ID,
        type: "line",
        source: ROADS_SOURCE_ID,
        "source-layer": "public.vietnam_roads",
        minzoom: 14,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
            "line-color": [
                "match", ["get", "fclass"],
                "motorway", "#ff5500",
                "trunk", "#ff8800",
                "primary", "#ffcc00",
                "secondary", "#ffe066",
                "tertiary", "#fff2b3",
                "residential", "#ffffff",
                "service", "#cccccc",
                "unclassified", "#e5e5e5",
                "#ffffff",
            ],
            "line-width": [
                "interpolate", ["linear"], ["zoom"],
                14, 5, 18, 9,
            ],
            "line-opacity": [
                "interpolate", ["linear"], ["zoom"],
                3, 0.95,
                6, 0.75,
                10, 0.45,
                14, 0.35,
                18, 0.2,
            ],
        },
    });
}