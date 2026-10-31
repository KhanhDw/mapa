export type LayerKey =
    // Ảnh 360
    | "streetview"
    // Giao thông
    | "roads"
    | "roadNames"
    | "roadsMajor"
    | "roadsMinor"
    | "roadsLocal"
    | "railways"
    // Tự nhiên
    | "water"
    | "waterways"
    | "landuse"
    | "natural"
    | "protected"
    // Xây dựng
    | "buildings"
    // Hành chính
    | "admin"
    // Địa danh & POI
    | "places"
    | "pois";

export type LayerVisibility = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerVisibility = {
    streetview: true,
    roads: true,
    roadNames: true,
    roadsMajor: false,
    roadsMinor: false,
    roadsLocal: false,
    railways: false,
    water: true,
    waterways: false,
    landuse: false,
    natural: false,
    protected: false,
    buildings: false,
    admin: false,
    places: false,
    pois: false,
};