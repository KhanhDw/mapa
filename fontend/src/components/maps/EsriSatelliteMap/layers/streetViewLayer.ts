import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
    SV_ICON_ID,
    SV_LAYER_ID,
    SV_MIN_ZOOM,
    SV_SOURCE_ID,
} from "../constants";
import { createStreetViewXIcon } from "../utils/createStreetViewXIcon";

interface EnsureOptions {
    map: MapLibreMap;
    onIconClick: (id: number) => void;
}

/** Thêm source rỗng + icon + layer + handlers 1 lần duy nhất. */
export function ensureStreetViewLayer({ map, onIconClick }: EnsureOptions): void {
    if (!map.getSource(SV_SOURCE_ID)) {
        map.addSource(SV_SOURCE_ID, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });
    }

    if (!map.hasImage(SV_ICON_ID)) {
        const canvas = createStreetViewXIcon(14);
        const ctx = canvas.getContext("2d")!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        map.addImage(SV_ICON_ID, imageData, {
            pixelRatio: window.devicePixelRatio || 1,
        });
    }

    if (!map.getLayer(SV_LAYER_ID)) {
        map.addLayer({
            id: SV_LAYER_ID,
            type: "symbol",
            source: SV_SOURCE_ID,
            minzoom: SV_MIN_ZOOM,
            layout: {
                "icon-image": SV_ICON_ID,
                "icon-size": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 0.5, 14, 0.7, 18, 1.0,
                ],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
            },
            paint: {
                "icon-opacity": [
                    "interpolate", ["linear"], ["zoom"],
                    16.9, 0, 17.0, 0.45, 17.7, 0.8, 18.2, 1.0,
                ],
            },
        });
        map.moveLayer(SV_LAYER_ID);

        map.on("click", SV_LAYER_ID, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (id != null) onIconClick(Number(id));
        });
        map.on("mouseenter", SV_LAYER_ID, () => {
            map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", SV_LAYER_ID, () => {
            map.getCanvas().style.cursor = "";
        });
    }
}

/** Cập nhật GeoJSON data cho source đã tồn tại. */
export function setStreetViewData(map: MapLibreMap, geojson: any): void {
    const src = map.getSource(SV_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(geojson);
}