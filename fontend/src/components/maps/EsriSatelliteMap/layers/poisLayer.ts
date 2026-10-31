import type { Map as MapLibreMap } from "maplibre-gl";
import { TILE_BASE } from "../../../../config";
import { POI_MIN_ZOOM, POIS_LAYER_ID, POIS_SOURCE_ID } from "../constants";

export function addPoisLayer(map: MapLibreMap): void {
    if (!map.getSource(POIS_SOURCE_ID)) {
        map.addSource(POIS_SOURCE_ID, {
            type: "vector",
            tiles: [`${TILE_BASE}/public.pois/{z}/{x}/{y}.pbf`],
            minzoom: 0,
            maxzoom: 14,
        });
    }

    if (!map.getLayer(POIS_LAYER_ID)) {
        map.addLayer({
            id: POIS_LAYER_ID,
            type: "circle",
            source: POIS_SOURCE_ID,
            "source-layer": "public.pois",   // ← đổi "pois" → "public.pois" (pg_tileserv emit có schema prefix, giống roads)
            minzoom: POI_MIN_ZOOM,
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 7, 19, 10],
                "circle-color": [
                    "match", ["get", "category"],
                    "restaurant", "#ef4444",
                    "cafe", "#b45309",
                    "hotel", "#3b82f6",
                    "school", "#8b5cf6",
                    "hospital", "#dc2626",
                    "shop", "#10b981",
                    "#f59e0b",
                ],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
                "circle-opacity": 0.92,
            },
        });
    }
}