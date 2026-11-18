import type { Map as MapLibreMap } from "maplibre-gl";
import {
    ROADS_LABEL_LAYER_ID,
    ROADS_LAYER_ID,
    ROADS_SOURCE_ID,
} from "../constants";

export function addRoadsLayer(map: MapLibreMap): void {
    const TILE_BASE = `${window.location.origin}/api/mvt`;

    if (!map.getSource(ROADS_SOURCE_ID)) {
        map.addSource(ROADS_SOURCE_ID, {
            type: "vector",
            tiles: [`${TILE_BASE}/roads/{z}/{x}/{y}.pbf`],
            minzoom: 0,
            maxzoom: 18,
        });
    }

    if (!map.getLayer(ROADS_LAYER_ID)) {
        map.addLayer({
            id: ROADS_LAYER_ID,
            type: "line",
            source: ROADS_SOURCE_ID,
            "source-layer": "roads",
            minzoom: 4,
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
                    "#ffffff",
                ],
                "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 5],
                "line-opacity": 0.85,
            },
        });
    }

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
                "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 20, 15],
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