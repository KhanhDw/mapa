export type LayerKey =
    // Ảnh 360
    | "streetview"
    // Giao thông & Hạ tầng
    | "roads"
    | "electric_poles"
    // Xây dựng
    | "buildings"
    // Hành chính
    | "admin"
    // Địa danh & POI
    | "places"
    | "pois"
    | "userPois";

export type LayerVisibility = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerVisibility = {
    streetview: true,
    roads: true,
    electric_poles: true,
    buildings: false,
    admin: true,
    places: false,
    pois: true,
    userPois: true,
};