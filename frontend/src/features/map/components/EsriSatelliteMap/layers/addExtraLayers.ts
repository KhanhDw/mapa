import type { Map as MapLibreMap } from "maplibre-gl";
import { EXTRA_LAYERS, extraTileUrl } from "./registry";

export function addExtraLayers(map: MapLibreMap): void {
    for (const def of EXTRA_LAYERS) {
        if (def.beforeAdd) def.beforeAdd(map);

        if (!map.getSource(def.sourceId)) {
            map.addSource(def.sourceId, {
                type: "vector",
                tiles: [extraTileUrl(def)],
                minzoom: 0,
                maxzoom: def.maxzoom ?? 14,
                ...(def.promoteId ? { promoteId: def.promoteId } : {}),
            });
        }

        // Thêm layer nền hover trước để nằm dưới icon POI
        if (def.hoverLayerId && def.hoverSpec && !map.getLayer(def.hoverLayerId)) {
            map.addLayer(def.hoverSpec(def.sourceId, def.hoverLayerId));
        }

        if (!map.getLayer(def.layerId)) {
            map.addLayer(def.spec(def.sourceId, def.layerId));
        }
    }
}