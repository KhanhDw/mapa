import type { Map as MapLibreMap } from "maplibre-gl";
import type { SearchResult } from "../../../../api/search";

const SOURCE_ID = "search-result-source";
const LINE_LAYER_ID = "search-result-line";
const POINT_LAYER_ID = "search-result-point";

export function showSearchResult(map: MapLibreMap, result: SearchResult): void {
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getLayer(POINT_LAYER_ID)) map.removeLayer(POINT_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (result.kind === "road" && result.geometry) {
        map.addSource(SOURCE_ID, {
            type: "geojson",
            data: {
                type: "Feature",
                properties: {},
                geometry: result.geometry,
            },
        });
        map.addLayer({
            id: LINE_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": "#f43f5e",
                "line-width": 7,
                "line-opacity": 0.95,
            },
        });

        if (result.bbox) {
            const [west, south, east, north] = result.bbox;
            map.fitBounds(
                [
                    [west, south],
                    [east, north],
                ],
                { padding: 100, maxZoom: 17, duration: 900 }
            );
        } else {
            map.flyTo({
                center: [result.lng, result.lat],
                zoom: 17,
                duration: 800,
            });
        }
        return;
    }

    map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: [result.lng, result.lat],
            },
        },
    });
    map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
            "circle-radius": 9,
            "circle-color": "#f43f5e",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
        },
    });
    map.flyTo({
        center: [result.lng, result.lat],
        zoom: 17,
        duration: 800,
    });
}
