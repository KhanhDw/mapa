
import type { Map as MapLibreMap } from "maplibre-gl";
import {
    ROADS_LABEL_LAYER_ID,
    ROADS_LAYER_ID,
    ROADS_SOURCE_ID,
} from "../constants";

export function addRoadsLayer(map: MapLibreMap): void {
    const TILE_BASE = `${window.location.origin}/api/mvt`;
    const CASING_LAYER_ID = `${ROADS_LAYER_ID}-casing`;

    if (!map.getSource(ROADS_SOURCE_ID)) {
        map.addSource(ROADS_SOURCE_ID, {
            type: "vector",
            tiles: [`${TILE_BASE}/roads/{z}/{x}/{y}.pbf`],
            minzoom: 0,
            maxzoom: 18,
        });
    }

    // ===== Road casing: viền tối bên dưới tuyến đường =====
    if (!map.getLayer(CASING_LAYER_ID)) {
        map.addLayer({
            id: CASING_LAYER_ID,
            type: "line",
            source: ROADS_SOURCE_ID,
            "source-layer": "roads",
            minzoom: 4,
            layout: {
                "line-join": "round",
                "line-cap": "round",
            },
            paint: {
                "line-color": "#263238",
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10, 2.5,
                    14, 5,
                    16, 8,
                    18, 11,
                ],
                "line-opacity": 0.25,
            },
        });
    }

    // ===== Main roads =====
    if (!map.getLayer(ROADS_LAYER_ID)) {
        map.addLayer({
            id: ROADS_LAYER_ID,
            type: "line",
            source: ROADS_SOURCE_ID,
            "source-layer": "roads",
            minzoom: 4,
            layout: {
                "line-join": "round",
                "line-cap": "round",
            },
            paint: {
                "line-color": [
                    "match",
                    ["get", "fclass"],

                    // Motorways
                    "motorway", "#FFD166",

                    // Major roads
                    "trunk", "#FFE08A",
                    "primary", "#FFF0B3",

                    // Secondary roads
                    "secondary", "#FFF5D6",
                    "tertiary", "#FFF9E8",

                    // Local roads
                    "residential", "#FFFFFF",
                    "living_street", "#FFFFFF",
                    "unclassified", "#FFFFFF",
                    "service", "#F5F5F5",

                    "#FFFFFF",
                ],

                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10, 1,
                    12, 1.8,
                    14, 2.8,
                    16, 4.5,
                    18, 6,
                ],

                "line-opacity": 0.45,
            },
        });
    }

    // ===== Road labels =====
    if (!map.getLayer(ROADS_LABEL_LAYER_ID)) {
        map.addLayer({
            id: ROADS_LABEL_LAYER_ID,
            type: "symbol",
            source: ROADS_SOURCE_ID,
            "source-layer": "roads",
            minzoom: 15,

            layout: {
                "text-field": ["coalesce", ["get", "name"], ""],
                "text-font": ["Noto Sans Regular"],

                "text-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15, 10,
                    17, 12,
                    20, 14,
                ],

                "symbol-placement": "line",
                "text-rotation-alignment": "map",
                "text-pitch-alignment": "viewport",
                "text-padding": 5,
                "text-allow-overlap": false,
            },

            paint: {
                "text-color": "#FFFFFF",
                "text-halo-color": "#263238",
                "text-halo-width": 1.5,
                "text-halo-blur": 0.3,
            },
        });
    }
}
