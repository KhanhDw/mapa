// Single source of truth cho toàn bộ URL. Spec §8: FE chỉ gọi :8000.
export const API_BASE =
    import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

// pg_tileserv proxy — spec §4.6
export const TILE_BASE = `${API_BASE}/tiles`;

// MVT tự sinh fallback — spec §4.7 (hiện chưa dùng, để sẵn)
export const MVT_BASE = `${API_BASE}/mvt`;

// versatiles basemap proxy — spec §4.5 (hiện chưa dùng, để sẵn)
export const BASEMAP_BASE = `${API_BASE}/basemap`;

// Satellite backend (dùng cho map selfhost sau này)
export const SATELLITE_TILE_URL =
    import.meta.env.VITE_SATELLITE_URL ??
    `${API_BASE}/basemap/satellite/{z}/{x}/{y}`;

// Esri external — map chính EsriSatelliteMap dùng cái này (spec §8 giữ external)
export const ESRI_SATELLITE_TILE_URL =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const OSM_TILE_URLS = [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
];

export function getMapLibreWorkerUrl(version: string): string {
    return `https://cdn.jsdelivr.net/npm/maplibre-gl@${version}/dist/maplibre-gl-worker.mjs`;
}