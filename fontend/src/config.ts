export const API_BASE =
    import.meta.env.VITE_API_BASE ?? "";

export const TILE_BASE =
    import.meta.env.VITE_TILE_BASE ??
    import.meta.env.VITE_TILESERVER_URL ??
    "/tileserver";

export const SATELLITE_TILE_URL =
    import.meta.env.VITE_SATELLITE_URL ??
    "/satellite/tiles/{z}/{x}/{y}";

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
