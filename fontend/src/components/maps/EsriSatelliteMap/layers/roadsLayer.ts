import type { Map as MapLibreMap } from "maplibre-gl";
import { TILE_BASE } from "../../../../config";
import { ROADS_LAYER_ID, ROADS_SOURCE_ID } from "../constants";

export function addRoadsLayer(map: MapLibreMap): void {
    // 1. Khai báo Source (Dùng chung cho cả Line và Label)
    if (!map.getSource(ROADS_SOURCE_ID)) {
        map.addSource(ROADS_SOURCE_ID, {
            type: "vector",
            tiles: [`${TILE_BASE}/public.vietnam_roads/{z}/{x}/{y}.pbf`],
            minzoom: 0,
            maxzoom: 14,
        });
    }

    // 2. Vẽ đường (Line) - Dùng lại ID cũ là ROADS_LAYER_ID
    if (!map.getLayer(ROADS_LAYER_ID)) {
        map.addLayer({
            id: ROADS_LAYER_ID,
            type: "line",
            source: ROADS_SOURCE_ID,
            "source-layer": "public.vietnam_roads",
            minzoom: 14, // Chỉ hiện ở zoom 14+
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
                "line-width": ["interpolate", ["linear"], ["zoom"], 14, 5, 18, 9],
                "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.95, 6, 0.75, 10, 0.45, 14, 0.35, 18, 0.2],
            },
        });
    }

    // 3. Vẽ tên đường (Label) - ID mới
    if (!map.getLayer("roads-label-layer")) {
        map.addLayer({
            id: "roads-label-layer",
            type: "symbol",
            source: ROADS_SOURCE_ID,
            "source-layer": "public.vietnam_roads",
            minzoom: 15, // Hiện tên đường khi zoom 15+
            layout: {
                "text-field": ["coalesce", ["get", "name"], ["get", "ref"], ""],
                "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 20, 16],
                "symbol-placement": "line",
                "text-rotation-alignment": "map",
                "text-pitch-alignment": "viewport",
                "text-padding": 5,
                "text-allow-overlap": false,
            },
            paint: {
                "text-color": "#1e293b",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
            },
        });
    }
}