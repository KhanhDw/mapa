import type { Map as MapLibreMap } from "maplibre-gl";
import type { LayerKey, LayerVisibility } from "../../../types/types";
import {
    ROADS_LABEL_LAYER_ID,
    ROADS_LAYER_ID,
    SV_LAYER_ID,
} from "../constants";
import { EXTRA_LAYERS } from "./registry";

/** Trả về các MapLibre layer id tương ứng với 1 LayerKey. */
function layerIdsFor(key: LayerKey): string[] {
    // Roads được quản lý riêng bởi roadsLayer.ts
    if (key === "roads") {
        return [
            `${ROADS_LAYER_ID}-casing`,
            ROADS_LAYER_ID,
            ROADS_LABEL_LAYER_ID,
        ];
    }

    const extra = EXTRA_LAYERS.find((d) => d.key === key);
    if (extra) return [extra.layerId];

    if (key === "streetview") return [SV_LAYER_ID];

    return [];
}

export function applyLayerVisibility(
    map: MapLibreMap,
    layers: LayerVisibility
): void {
    (Object.keys(layers) as LayerKey[]).forEach((key) => {
        const visibility = layers[key] ? "visible" : "none";
        layerIdsFor(key).forEach((id) => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, "visibility", visibility);
            }
        });
    });
}