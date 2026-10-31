import type { Map as MapLibreMap } from "maplibre-gl";
import { TILE_BASE } from "../../../../config";
import { EXTRA_LAYERS } from "./registry";

/**
 * Thêm toàn bộ source + layer từ registry.
 * Gọi 1 lần khi map load. Idempotent (guard getSource/getLayer).
 */
export function addExtraLayers(map: MapLibreMap): void {
    for (const def of EXTRA_LAYERS) {
        if (!map.getSource(def.sourceId)) {
            map.addSource(def.sourceId, {
                type: "vector",
                tiles: [`${TILE_BASE}/${def.schemaTable}/{z}/{x}/{y}.pbf`],
                minzoom: 0,
                maxzoom: def.maxzoom ?? 14,
            });
        }
        if (!map.getLayer(def.layerId)) {
            map.addLayer(def.spec(def.sourceId, def.layerId));
        }
    }
}