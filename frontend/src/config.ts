
// ============================================================================
// Single source of truth cho toàn bộ URL trong Frontend (Vite)
// Đồng bộ với .env (hỗ trợ Ngrok và Localhost)
// ============================================================================

// 1. Base API URL

const envBase = (import.meta.env.VITE_API_BASE ?? "")
    .trim()
    .replace(/\/+$/, "");

export const API_BASE = import.meta.env.DEV ? "" : envBase;

// 2. Kiểm tra môi trường Ngrok

export const IS_NGROK =
    !import.meta.env.DEV &&
    (
        import.meta.env.VITE_USE_NGROK === "true" ||
        API_BASE.includes("ngrok-free.app") ||
        API_BASE.includes("ngrok.app")
    );

// 3. pg_tileserv proxy

export const TILE_BASE = `${API_BASE}/tiles`;

// 4. MVT tự sinh fallback

export const MVT_BASE = `${API_BASE}/mvt`;

// 5. Versatiles basemap proxy

export const BASEMAP_BASE = `${API_BASE}/basemap`;

// 6. Satellite backend

export const SATELLITE_TILE_URL =
    import.meta.env.VITE_SATELLITE_URL ||
    `${BASEMAP_BASE}/satellite/{z}/{x}/{y}`;

// 7. ESRI World Imagery Satellite

export const ESRI_SATELLITE_TILE_URL =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// 8. OpenStreetMap tiles

export const OSM_TILE_URLS = [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
];

// 9. Endpoint đóng góp POI / dữ liệu cộng đồng

export const CONTRIBUTE_BASE = `${API_BASE}/api/contribute`;

// 10. MapLibre Worker
// Worker được đóng gói local bởi Vite.
// Không sử dụng CDN jsDelivr.

import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

export const MAPLIBRE_WORKER_URL = maplibreWorkerUrl;

// Giữ lại hàm cũ để tránh lỗi nếu file khác vẫn đang import.
// Worker URL không còn phụ thuộc CDN.

export function getMapLibreWorkerUrl(_version?: string): string {
    return MAPLIBRE_WORKER_URL;
}
