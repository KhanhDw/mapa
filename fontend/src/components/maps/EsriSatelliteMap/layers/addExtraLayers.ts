import type { Map as MapLibreMap } from "maplibre-gl";
import { EXTRA_LAYERS, extraTileUrl } from "./registry";

export function addExtraLayers(map: MapLibreMap): void {
    for (const def of EXTRA_LAYERS) {
        if (def.beforeAdd) def.beforeAdd(map);

        if (!map.getSource(def.sourceId)) {
            map.addSource(def.sourceId, {
                type: "vector",
                // tiles: [`${TILE_BASE}/${def.schemaTable}/{z}/{x}/{y}.pbf`],
                tiles: [extraTileUrl(def)],
                minzoom: 0,
                maxzoom: def.maxzoom ?? 14,
            });
        }
        if (!map.getLayer(def.layerId)) {
            map.addLayer(def.spec(def.sourceId, def.layerId));
        }
    }
}