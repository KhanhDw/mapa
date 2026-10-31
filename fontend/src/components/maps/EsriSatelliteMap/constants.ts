import type { MapOptions } from "maplibre-gl";

/** View khởi tạo của bản đồ Esri */
export const ESRI_INITIAL_VIEW: Pick<
    MapOptions,
    "center" | "zoom" | "minZoom" | "maxZoom"
> = {
    center: [105.43, 10.38],
    zoom: 13,
    minZoom: 3,
    maxZoom: 18,
};

/** Zoom tại đó scale bar hiển thị 100m (vĩ độ ~10.38°) */
export const SV_MIN_ZOOM = 16.9;

/** ID dùng chung cho source / layer / image */
export const ROADS_SOURCE_ID = "roads-pg";
export const ROADS_LAYER_ID = "roads-pg-layer";
export const SV_SOURCE_ID = "sv-points";
export const SV_LAYER_ID = "sv-points-layer";
export const SV_ICON_ID = "sv-x-icon";
export const ROADS_LABEL_LAYER_ID = "roads-label-layer";