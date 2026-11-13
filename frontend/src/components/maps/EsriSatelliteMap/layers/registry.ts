// Registry cho toàn bộ layer bổ sung. Thêm layer mới = 3 chỗ (LAYER_META,
// EXTRA_LAYERS, LayerKey ở panels/types.ts).
import type {
    ExpressionSpecification,
    LayerSpecification,
    Map as MapLibreMap,
} from "maplibre-gl";
import type {
    LayerKey,
    LayerVisibility,
} from "../../../layout/panels/types";
import {
    ICON_MATCH,
    USER_ICON_MATCH,
    USER_PIN_PREFIX,
    registerPoiIcons,
    registerUserPoiIcons,
} from "../utils/createPoiIcon";

export type LayerCategory =
    | "sv"
    | "transport"
    | "nature"
    | "built"
    | "admin"
    | "place";

export interface LayerGroupMeta {
    id: LayerCategory;
    title: string;
}

export const LAYER_GROUPS: LayerGroupMeta[] = [
    { id: "sv", title: "Ảnh 360" },
    { id: "transport", title: "Giao thông" },
    { id: "nature", title: "Tự nhiên" },
    { id: "built", title: "Xây dựng" },
    { id: "admin", title: "Hành chính" },
    { id: "place", title: "Địa danh & POI" },
];

export interface LayerMeta {
    key: LayerKey;
    category: LayerCategory;
    title: string;
    description: string;
}

export const LAYER_META: LayerMeta[] = [
    { key: "streetview", category: "sv", title: "Đường có ảnh 360°", description: "Dấu X xanh, zoom ≥ 17" },

    { key: "roads", category: "transport", title: "Đường (tổng hợp)", description: "fclass từ OSM, zoom ≥ 14" },
    { key: "roadNames", category: "transport", title: "Tên đường (tổng hợp)", description: "Nhãn tên, zoom ≥ 15" },
    { key: "roadsMajor", category: "transport", title: "Đường lớn", description: "Cao tốc, quốc lộ" },
    { key: "roadsMinor", category: "transport", title: "Đường nhỏ", description: "Tỉnh lộ, huyện lộ" },
    { key: "roadsLocal", category: "transport", title: "Đường nội bộ", description: "Phố, ngõ, zoom ≥ 14" },
    { key: "railways", category: "transport", title: "Đường sắt", description: "Tuyến đường sắt" },

    { key: "water", category: "nature", title: "Mặt nước", description: "Sông, hồ, biển" },
    { key: "waterways", category: "nature", title: "Dòng chảy", description: "Sông, suối, kênh" },
    { key: "landuse", category: "nature", title: "Sử dụng đất", description: "Khu dân cư, nông nghiệp" },
    { key: "natural", category: "nature", title: "Tự nhiên", description: "Rừng, bãi biển" },
    { key: "protected", category: "nature", title: "Khu bảo tồn", description: "Vườn quốc gia" },

    { key: "buildings", category: "built", title: "Nhà / công trình", description: "Tòa nhà, zoom ≥ 15" },

    { key: "admin", category: "admin", title: "Ranh giới hành chính", description: "Tỉnh, huyện, xã" },

    { key: "places", category: "place", title: "Địa danh", description: "Tên thành phố, làng" },
    { key: "pois", category: "place", title: "POI (địa điểm)", description: "Điểm quan tâm từ OSM" },
    { key: "userPois", category: "place", title: "POI đóng góp", description: "Địa điểm do người dùng gửi" },
];

/* ────────────────────────────────────────────────────────────────────────────
 * 5 lớp bật mặc định: 3 lớp đầu + 2 lớp cuối trong LAYER_META
 *  - streetview, roads, roadNames, pois, userPois
 * Chốt cứng key (thay vì slice) để không vỡ khi ai đó chèn/xoá phần tử.
 * ──────────────────────────────────────────────────────────────────────────── */
export const DEFAULT_LAYER_KEYS: LayerKey[] = [
    "streetview",
    "roads",
    "roadNames",
    "pois",
    "userPois",
];

export const DEFAULT_LAYER_KEY_SET: ReadonlySet<LayerKey> =
    new Set<LayerKey>(DEFAULT_LAYER_KEYS);

/** Tạo LayerVisibility mặc định: chỉ bật 5 lớp ưu tiên, tắt phần còn lại. */
export function createDefaultLayerVisibility(): LayerVisibility {
    const out = {} as LayerVisibility;
    for (const meta of LAYER_META) {
        out[meta.key] = DEFAULT_LAYER_KEY_SET.has(meta.key);
    }
    return out;
}

export interface ExtraLayerDef {
    key: LayerKey;
    sourceId: string;
    layerId: string;
    schemaTable: string;
    sourceLayer: string;
    maxzoom?: number;
    beforeAdd?: (map: MapLibreMap) => void;
    spec: (sourceId: string, layerId: string) => LayerSpecification;
    tilePath?: string;
}

function matchExpr(
    key: string,
    mapping: Record<string, string>,
    fallback: string
): ExpressionSpecification {
    const out: unknown[] = ["match", ["get", key]];
    for (const [k, v] of Object.entries(mapping)) out.push(k, v);
    out.push(fallback);
    return out as unknown as ExpressionSpecification;
}

// Gọi cùng origin để Vite proxy chuyển request đến backend.
// const MVT_BASE = "/mvt";
const MVT_BASE = `${window.location.origin}/mvt`;
const TILE_PROXY_BASE = `${window.location.origin}/tiles`;

export function extraTileUrl(def: ExtraLayerDef, bust = false): string {
    const base = def.tilePath
        ? `${MVT_BASE}/${def.tilePath}`
        : `${TILE_PROXY_BASE}/${def.schemaTable}`;

    return `${base}/{z}/{x}/{y}.pbf${bust ? `?v=${Date.now()}` : ""}`;
}

export const EXTRA_LAYERS: ExtraLayerDef[] = [
    // ========== GIAO THÔNG ==========
    {
        key: "roadsMajor",
        sourceId: "src-roads-major",
        layerId: "lay-roads-major",
        schemaTable: "clean.roads_major",
        sourceLayer: "clean.roads_major",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "clean.roads_major",
            minzoom: 5,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": ["match", ["get", "kind"],
                    "highway", "#f97316",
                    "major", "#fbbf24",
                    "#fcd34d"],
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 12, 2.5, 18, 8],
                "line-opacity": 0.95,
            },
        }),
    },
    {
        key: "roadsMinor",
        sourceId: "src-roads-minor",
        layerId: "lay-roads-minor",
        schemaTable: "clean.roads_minor",
        sourceLayer: "clean.roads_minor",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "clean.roads_minor",
            minzoom: 10,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": "#fde68a",
                "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1.5, 18, 4],
                "line-opacity": 0.85,
            },
        }),
    },
    {
        key: "roadsLocal",
        sourceId: "src-roads-local",
        layerId: "lay-roads-local",
        schemaTable: "clean.roads_local",
        sourceLayer: "clean.roads_local",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "clean.roads_local",
            minzoom: 14,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": "#ffffff",
                "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.4, 18, 2],
                "line-opacity": 0.55,
            },
        }),
    },
    {
        key: "railways",
        sourceId: "src-railways",
        layerId: "lay-railways",
        schemaTable: "clean.railways",
        sourceLayer: "clean.railways",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "clean.railways",
            minzoom: 8,
            layout: { "line-join": "round" },
            paint: {
                "line-color": "#6b7280",
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 1.8, 18, 3],
                "line-dasharray": [3, 2],
                "line-opacity": 0.85,
            },
        }),
    },

    // ========== TỰ NHIÊN ==========
    {
        key: "water",
        sourceId: "src-water",
        layerId: "lay-water",
        schemaTable: "clean.water_areas",
        sourceLayer: "clean.water_areas",
        spec: (src, id) => ({
            id,
            type: "fill",
            source: src,
            "source-layer": "clean.water_areas",
            minzoom: 4,
            paint: {
                "fill-color": "#7dd3fc",
                "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 12, 0.6, 18, 0.7],
            },
        }),
    },
    {
        key: "waterways",
        sourceId: "src-waterways",
        layerId: "lay-waterways",
        schemaTable: "clean.waterways",
        sourceLayer: "clean.waterways",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "clean.waterways",
            minzoom: 8,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": "#7dd3fc",
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 2, 18, 5],
                "line-opacity": 0.8,
            },
        }),
    },
    {
        key: "landuse",
        sourceId: "src-landuse",
        layerId: "lay-landuse",
        schemaTable: "clean.landuse",
        sourceLayer: "clean.landuse",
        spec: (src, id) => ({
            id,
            type: "fill",
            source: src,
            "source-layer": "clean.landuse",
            minzoom: 10,
            paint: {
                "fill-color": ["match", ["get", "kind"],
                    "residential", "#fef3c7",
                    "commercial", "#fecaca",
                    "industrial", "#e5e7eb",
                    "farmland", "#dcfce7",
                    "forest", "#bbf7d0",
                    "#f3f4f6"],
                "fill-opacity": 0.35,
            },
        }),
    },
    {
        key: "natural",
        sourceId: "src-natural",
        layerId: "lay-natural",
        schemaTable: "clean.natural_areas",
        sourceLayer: "clean.natural_areas",
        spec: (src, id) => ({
            id,
            type: "fill",
            source: src,
            "source-layer": "clean.natural_areas",
            minzoom: 8,
            paint: {
                "fill-color": ["match", ["get", "kind"],
                    "wood", "#86efac",
                    "sand", "#fde68a",
                    "wetland", "#a7f3d0",
                    "beach", "#fef3c7",
                    "#d1fae5"],
                "fill-opacity": 0.45,
            },
        }),
    },
    {
        key: "protected",
        sourceId: "src-protected",
        layerId: "lay-protected",
        schemaTable: "clean.protected_areas",
        sourceLayer: "clean.protected_areas",
        spec: (src, id) => ({
            id,
            type: "fill",
            source: src,
            "source-layer": "clean.protected_areas",
            minzoom: 5,
            paint: {
                "fill-color": "#10b981",
                "fill-opacity": 0.15,
                "fill-outline-color": "#059669",
            },
        }),
    },

    // ========== XÂY DỰNG ==========
    {
        key: "buildings",
        sourceId: "src-buildings",
        layerId: "lay-buildings",
        schemaTable: "clean.buildings",
        sourceLayer: "clean.buildings",
        maxzoom: 16,
        spec: (src, id) => ({
            id,
            type: "fill",
            source: src,
            "source-layer": "clean.buildings",
            minzoom: 15,
            paint: {
                "fill-color": "#d4d4d8",
                "fill-opacity": 0.75,
                "fill-outline-color": "#a1a1aa",
            },
        }),
    },

    // ========== HÀNH CHÍNH ==========
    {
        key: "admin",
        sourceId: "src-admin",
        layerId: "lay-admin",
        schemaTable: "clean.admin_areas",
        sourceLayer: "clean.admin_areas",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "clean.admin_areas",
            minzoom: 3,
            paint: {
                "line-color": ["match", ["get", "kind"],
                    "country", "#dc2626",
                    "state", "#ea580c",
                    "county", "#f59e0b",
                    "#9ca3af"],
                "line-width": ["match", ["get", "kind"],
                    "country", 2,
                    "state", 1.5,
                    "county", 1,
                    0.8],
                "line-dasharray": [4, 3],
                "line-opacity": 0.75,
            },
        }),
    },

    // ========== ĐỊA DANH & POI ==========
    {
        key: "places",
        sourceId: "src-places",
        layerId: "lay-places",
        schemaTable: "clean.places",
        sourceLayer: "clean.places",
        spec: (src, id) => ({
            id,
            type: "symbol",
            source: src,
            "source-layer": "clean.places",
            minzoom: 5,
            layout: {
                "text-field": ["coalesce", ["get", "name"], ""],
                "text-font": ["Noto Sans Regular"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 10, 13, 16, 16],
                "text-allow-overlap": false,
                "text-padding": 4,
            },
            paint: {
                "text-color": "#0f172a",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.8,
            },
        }),
    },
    {
        key: "pois",
        sourceId: "src-pois",
        layerId: "lay-pois",
        schemaTable: "clean.pois",
        sourceLayer: "clean.pois",
        beforeAdd: registerPoiIcons,
        spec: (src, id) => ({
            id,
            type: "symbol",
            source: src,
            "source-layer": "clean.pois",
            minzoom: 13,
            layout: {
                "icon-image": matchExpr("fclass", ICON_MATCH, "poi-icon-default"),
                "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 16, 0.8, 19, 1.0],
                "icon-allow-overlap": true,
                "icon-ignore-placement": false,
                "text-field": ["coalesce", ["get", "name"], ""],
                "text-font": ["Noto Sans Regular"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 13, 9, 16, 11, 19, 13],
                "text-offset": [0, 1.4],
                "text-anchor": "top",
                "text-allow-overlap": false,
                "text-padding": 2,
                "text-max-width": 8,
            },
            paint: {
                "icon-opacity": 0.95,
                "text-color": "#0f172a",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
            },
        }),
    },
    {
        key: "userPois",
        sourceId: "src-user-pois",
        layerId: "lay-user-pois",
        schemaTable: "user_data.pois",
        sourceLayer: "user_data.pois",
        tilePath: "user_data.pois",
        beforeAdd: (map) => {
            registerPoiIcons(map);
            registerUserPoiIcons(map);
        },
        spec: (src, id) => ({
            id,
            type: "symbol",
            source: src,
            "source-layer": "user_data.pois",
            minzoom: 10,
            layout: {
                "icon-image": matchExpr("category", USER_ICON_MATCH, USER_PIN_PREFIX + "default"),
                "icon-anchor": "bottom",
                "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 15, 0.9, 19, 1.1],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "text-field": ["coalesce", ["get", "name"], ""],
                "text-font": ["Noto Sans Regular"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 16, 13, 19, 15],
                "text-anchor": "top",
                "text-offset": [0, 0.3],
                "text-optional": true,      // nhãn bị chồng thì ẩn nhãn, giữ icon
                "text-max-width": 8,
                "text-padding": 2,
            },
            paint: {
                "icon-opacity": 1,
                "text-color": "#7c2d12",
                "text-halo-color": "#fff7ed",
                "text-halo-width": 2,
            },
        }),
    },
];