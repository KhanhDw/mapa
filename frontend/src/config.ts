// ============================================================================
// Single source of truth cho toàn bộ URL trong Frontend (Vite)
// Đồng bộ với .env (hỗ trợ chuyển đổi mượt mà giữa Ngrok và Localhost)
// ============================================================================

// 1. Base API URL (tự động loại bỏ dấu "/" ở cuối nếu người dùng lỡ tay thêm vào trong .env)
// const rawApiBase = import.meta.env.VITE_API_BASE;
// export const API_BASE = (
//     rawApiBase && rawApiBase.trim() !== ""
//         ? rawApiBase.trim()
//         : "http://127.0.0.1:8000"
// ).replace(/\/+$/, "");
// export const API_BASE = (
//     import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim() !== ""
//         ? import.meta.env.VITE_API_BASE.trim()
//         : "https://cougar-settling-commonly.ngrok-free.app" // 👈 ÉP THẲNG DOMAIN NGROK Ở ĐÂY
// ).replace(/\/+$/, "");

const envBase = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");
export const API_BASE = import.meta.env.DEV ? "" : envBase;
export const IS_NGROK = !import.meta.env.DEV && (
    import.meta.env.VITE_USE_NGROK === "true" ||
    API_BASE.includes("ngrok-free.app") ||
    API_BASE.includes("ngrok.app")
);



// 2. Cờ kiểm tra có đang chạy qua môi trường Ngrok hay không
// export const IS_NGROK =
//     import.meta.env.VITE_USE_NGROK === "true" ||
//     API_BASE.includes("ngrok-free.app") ||
//     API_BASE.includes("ngrok.app");

// 3. pg_tileserv proxy (Vector Tiles cho tuyến đường, hạ tầng...) — spec §4.6
// Ví dụ: https://cougar-settling-commonly.ngrok-free.app/tiles
export const TILE_BASE = `${API_BASE}/tiles`;

// 4. MVT tự sinh fallback — spec §4.7
// Ví dụ: https://cougar-settling-commonly.ngrok-free.app/mvt
export const MVT_BASE = `${API_BASE}/mvt`;

// 5. Versatiles basemap proxy — spec §4.5
export const BASEMAP_BASE = `${API_BASE}/basemap`;

// 6. Satellite backend (dùng cho map tự host từ Versatiles)
export const SATELLITE_TILE_URL =
    import.meta.env.VITE_SATELLITE_URL ||
    `${BASEMAP_BASE}/satellite/{z}/{x}/{y}`;

// 7. Esri external Imagery (Map chính EsriSatelliteMap sử dụng trực tiếp)
export const ESRI_SATELLITE_TILE_URL =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// 8. OpenStreetMap basemap tiles
export const OSM_TILE_URLS = [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
];

// 9. Endpoint đóng góp POI / dữ liệu cộng đồng
export const CONTRIBUTE_BASE = `${API_BASE}/api/contribute`;

// 10. Web Worker cho MapLibre GL JS (tối ưu hóa luồng dựng map vector)
export function getMapLibreWorkerUrl(version: string): string {
    return `https://cdn.jsdelivr.net/npm/maplibre-gl@${version}/dist/maplibre-gl-worker.mjs`;
}