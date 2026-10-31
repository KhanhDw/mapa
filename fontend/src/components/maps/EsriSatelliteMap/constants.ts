import type { MapOptions } from "maplibre-gl";

/** View khởi tạo — Cao Lãnh, Đồng Tháp */
export const ESRI_INITIAL_VIEW: Pick<
    MapOptions,
    "center" | "zoom" | "minZoom" | "maxZoom"
> = {
    center: [105.243684, 10.799102], // [lng, lat]
    zoom: 14,
    minZoom: 3,
    maxZoom: 19,
};

/** Ngưỡng zoom hiển thị street view X */
export const SV_MIN_ZOOM = 16.9;

/** Giới hạn điểm SV fetch 1 lần — spec §4.2 (max 20000) */
export const SV_LIMIT = 5000;

/** Point-info mặc định — spec §4.3 */
export const POINT_INFO_RADIUS_M = 50;
export const POINT_INFO_POI_LIMIT = 10;

/** ID dùng chung */
export const ROADS_SOURCE_ID = "roads-pg";
export const ROADS_LAYER_ID = "roads-pg-layer";
export const ROADS_LABEL_LAYER_ID = "roads-label-layer";

export const SV_SOURCE_ID = "sv-points";
export const SV_LAYER_ID = "sv-points-layer";
export const SV_ICON_ID = "sv-x-icon";


export const POIS_SOURCE_ID = "pois-pg";
export const POIS_LAYER_ID = "pois-pg-layer";
export const POI_MIN_ZOOM = 11;