// Registry khai báo cho tất cả layer bổ sung trên EsriSatelliteMap.
// Thêm layer mới: 1 object trong EXTRA_LAYERS + 1 dòng trong LAYER_META +
// 1 key trong LayerVisibility (types.ts). Không sửa logic map.
import type { LayerSpecification } from "maplibre-gl";
import type { LayerKey } from "../../../layout/panels/types";

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

/** Metadata cho toàn bộ layer (kể cả 3 layer hard-coded trong roads/SV). */
export const LAYER_META: LayerMeta[] = [
    // Ảnh 360
    { key: "streetview", category: "sv", title: "Đường có ảnh 360°", description: "Dấu X xanh, zoom ≥ 17" },

    // Giao thông
    { key: "roads", category: "transport", title: "Đường (tổng hợp)", description: "fclass từ OSM, zoom ≥ 14" },
    { key: "roadNames", category: "transport", title: "Tên đường (tổng hợp)", description: "Nhãn tên, zoom ≥ 15" },
    { key: "roadsMajor", category: "transport", title: "Đường lớn", description: "Cao tốc, quốc lộ" },
    { key: "roadsMinor", category: "transport", title: "Đường nhỏ", description: "Tỉnh lộ, huyện lộ" },
    { key: "roadsLocal", category: "transport", title: "Đường nội bộ", description: "Phố, ngõ, zoom ≥ 14" },
    { key: "railways", category: "transport", title: "Đường sắt", description: "Tuyến đường sắt" },

    // Tự nhiên
    { key: "water", category: "nature", title: "Mặt nước", description: "Sông, hồ, biển" },
    { key: "waterways", category: "nature", title: "Dòng chảy", description: "Sông, suối, kênh" },
    { key: "landuse", category: "nature", title: "Sử dụng đất", description: "Khu dân cư, nông nghiệp" },
    { key: "natural", category: "nature", title: "Tự nhiên", description: "Rừng, bãi biển" },
    { key: "protected", category: "nature", title: "Khu bảo tồn", description: "Vườn quốc gia" },

    // Xây dựng
    { key: "buildings", category: "built", title: "Nhà / công trình", description: "Tòa nhà, zoom ≥ 15" },

    // Hành chính
    { key: "admin", category: "admin", title: "Ranh giới hành chính", description: "Tỉnh, huyện, xã" },

    // Địa danh & POI
    { key: "places", category: "place", title: "Địa danh", description: "Tên thành phố, làng" },
    { key: "pois", category: "place", title: "POI (địa điểm)", description: "Điểm quan tâm từ OSM" },
];

export interface ExtraLayerDef {
    key: LayerKey;
    sourceId: string;
    layerId: string;
    /** "<schema>.<table>" — dùng trong URL tile */
    schemaTable: string;
    /** Layer name trong PBF (pg_tileserv emit schema.table) */
    sourceLayer: string;
    /** maxzoom của source — default 14 */
    maxzoom?: number;
    /** Trả về LayerSpecification đầy đủ (id/source được inject) */
    spec: (sourceId: string, layerId: string) => LayerSpecification;
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
                "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
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
        spec: (src, id) => ({
            id,
            type: "circle",
            source: src,
            "source-layer": "clean.pois",
            minzoom: 13,
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3, 16, 6, 19, 9],
                "circle-color": ["match", ["get", "kind"],
                    "restaurant", "#ef4444",
                    "cafe", "#b45309",
                    "hotel", "#3b82f6",
                    "school", "#8b5cf6",
                    "hospital", "#dc2626",
                    "shop", "#10b981",
                    "#f59e0b"],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
                "circle-opacity": 0.92,
            },
        }),
    },
];