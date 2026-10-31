import type { Map as MapLibreMap } from "maplibre-gl";
import type { LayerKey, LayerVisibility } from "../../../layout/panels/types";
import {
    ROADS_LABEL_LAYER_ID,
    ROADS_LAYER_ID,
    SV_LAYER_ID,
} from "../constants";

/** Mỗi "lớp" trong panel ứng với 1 hoặc nhiều layer MapLibre. */
const LAYER_MAP_IDS: Record<LayerKey, string[]> = {
    roads: [ROADS_LAYER_ID],
    roadNames: [ROADS_LABEL_LAYER_ID],
    streetview: [SV_LAYER_ID],
};

export function applyLayerVisibility(map: MapLibreMap, layers: LayerVisibility): void {
    (Object.keys(LAYER_MAP_IDS) as LayerKey[]).forEach((key) => {
        const visibility = layers[key] ? "visible" : "none";
        LAYER_MAP_IDS[key].forEach((id) => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, "visibility", visibility);
            }
        });
    });
}