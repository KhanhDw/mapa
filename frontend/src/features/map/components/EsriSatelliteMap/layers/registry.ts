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
} from "../../../types/types";
import {
    POI_ICON_PREFIX,
    USER_PIN_PREFIX,
    poiIconRepository,
} from "../utils/PoiIconRepository";

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

    { key: "roads", category: "transport", title: "Đường giao thông", description: "Từ public.vietnam_roads" },
    { key: "electric_poles", category: "transport", title: "Cột điện", description: "Hạ tầng điện lực (user_data)" },

    { key: "buildings", category: "built", title: "Nhà / công trình", description: "Tòa nhà, zoom ≥ 15" },

    { key: "admin", category: "admin", title: "Ranh giới xã/phường", description: "vietnam_wards_2025" },

    { key: "places", category: "place", title: "Địa danh", description: "Tên thành phố, làng" },
    { key: "pois", category: "place", title: "POI (địa điểm)", description: "Điểm quan tâm từ OSM" },
    { key: "userPois", category: "place", title: "POI đóng góp", description: "Địa điểm do người dùng gửi" },
];

/** 5 lớp bật mặc định ban đầu */
export const DEFAULT_LAYER_KEYS: LayerKey[] = [
    "streetview",
    "roads",
    "admin",
    "pois",
    "userPois",
];

export const DEFAULT_LAYER_KEY_SET: ReadonlySet<LayerKey> =
    new Set<LayerKey>(DEFAULT_LAYER_KEYS);

/** Tạo LayerVisibility mặc định */
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
    hoverLayerId?: string;
    layerId: string;
    schemaTable: string; // Tên alias gửi lên endpoint /api/mvt/{table}
    sourceLayer: string; // Tên layer bên trong file PBF
    promoteId?: string;
    maxzoom?: number;
    beforeAdd?: (map: MapLibreMap) => void;
    hoverSpec?: (sourceId: string, hoverLayerId: string) => LayerSpecification;
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

/**
 * Đưa text nằm ngang bên trái/phải icon theo mức zoom:
 * - Zoom < 15: neo bên trái ("right"), offset âm để đẩy chữ sang trái
 * - Zoom >= 15: neo bên phải ("left"), offset dương để đẩy chữ sang phải
 */
function sideTextAnchorExpr(): ExpressionSpecification {
    return [
        "step",
        ["zoom"],
        "right",
        15,
        "left",
    ] as unknown as ExpressionSpecification;
}

function sideTextOffsetExpr(gap = 0.95): ExpressionSpecification {
    return [
        "step",
        ["zoom"],
        ["literal", [-gap, 0]],
        15,
        ["literal", [gap, 0]],
    ] as unknown as ExpressionSpecification;
}

// Trỏ qua tiền tố /api/mvt và /api/tiles đúng chuẩn backend mới
const MVT_BASE = `${window.location.origin}/api/mvt`;

export function extraTileUrl(def: ExtraLayerDef, bust = false): string {
    const base = def.tilePath
        ? `${MVT_BASE}/${def.tilePath}`
        : `${MVT_BASE}/${def.schemaTable}`;

    return `${base}/{z}/{x}/{y}.pbf${bust ? `?v=${Date.now()}` : ""}`;
}

export const EXTRA_LAYERS: ExtraLayerDef[] = [
    // ========== POI HỆ THỐNG (OSM) ==========
    {
        key: "pois",
        sourceId: "src-pois",
        hoverLayerId: "lay-pois-hover",
        layerId: "lay-pois",
        schemaTable: "pois",
        promoteId: "id",
        sourceLayer: "pois",
        beforeAdd: (map) => poiIconRepository.registerStandardIcons(map),
        hoverSpec: (src, hoverId) => ({
            id: hoverId,
            type: "circle",
            source: src,
            "source-layer": "pois",
            minzoom: 11,
            paint: {
                "circle-radius": [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    18,
                    0,
                ],
                "circle-color": "rgba(59, 130, 246, 0.32)",
                "circle-stroke-width": [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    2,
                    0,
                ],
                "circle-stroke-color": "#93c5fd",
                "circle-radius-transition": { duration: 150 },
                "circle-opacity-transition": { duration: 150 },
            },
        }),
        spec: (src, id) => ({
            id,
            type: "symbol",
            source: src,
            "source-layer": "pois",
            minzoom: 11,
            layout: {
                "icon-image": matchExpr(
                    "fclass",
                    poiIconRepository.getIconMatch(),
                    POI_ICON_PREFIX + "default"
                ),
                "icon-anchor": "center",
                "icon-size": [
                    "*",
                    [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        11, 0.8,
                        15, 0.95,
                        19, 1.1,
                    ],
                    [
                        "case",
                        ["boolean", ["feature-state", "hover"], false],
                        1.2,
                        1.0,
                    ],
                ],
                "icon-allow-overlap": false,
                "icon-padding": 2,
                "text-field": [
                    "step",
                    ["zoom"],
                    "",
                    13,
                    ["coalesce", ["get", "name"], ""],
                ],
                "text-font": ["Noto Sans Regular"],
                "text-size": 14,
                "text-anchor": sideTextAnchorExpr(),
                "text-offset": sideTextOffsetExpr(0.95),
                "text-allow-overlap": false,
                "text-optional": true,
            },
            paint: {
                "text-color": "#ffffff",
                "text-halo-color": "#111827",
                "text-halo-width": 1.8,
            },
        }),
    },
    // ========== HÀNH CHÍNH (WARDS) ==========
    {
        key: "admin",
        sourceId: "src-admin-wards",
        layerId: "lay-admin-wards",
        schemaTable: "wards",
        sourceLayer: "wards",
        spec: (src, id) => ({
            id,
            type: "line",
            source: src,
            "source-layer": "wards",
            minzoom: 5,
            paint: {
                "line-color": "#FFD700",
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    5, 1.5,
                    10, 2.5,
                    15, 3.5,
                ],
                "line-dasharray": [3, 2],
                "line-opacity": 0.95,
            },
        }),
    },
    // ========== CỘT ĐIỆN (ELECTRIC POLES) ==========
    {
        key: "electric_poles",
        sourceId: "src-electric-poles",
        layerId: "lay-electric-poles",
        schemaTable: "electric_poles",
        sourceLayer: "electric_poles",
        spec: (src, id) => ({
            id,
            type: "circle",
            source: src,
            "source-layer": "electric_poles",
            minzoom: 12,
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6],
                "circle-color": [
                    "match", ["get", "status"],
                    "good", "#10b981",
                    "warning", "#f59e0b",
                    "error", "#ef4444",
                    "#3b82f6",
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
            },
        }),
    },
    // ========== POI NGƯỜI DÙNG ==========
    {
        key: "userPois",
        sourceId: "src-user-pois",
        layerId: "lay-user-pois",
        hoverLayerId: "lay-user-pois-hover",
        schemaTable: "user_pois",
        sourceLayer: "user_pois",
        tilePath: "user_pois",
        beforeAdd: (map) => {
            poiIconRepository.registerStandardIcons(map);
            poiIconRepository.registerPinIcons(map);
        },
        hoverSpec: (src, hoverId) => ({
            id: hoverId,
            type: "circle",
            source: src,
            "source-layer": "user_pois",
            minzoom: 10,
            paint: {
                "circle-radius": [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    19,
                    0,
                ],
                "circle-color": "rgba(245, 158, 11, 0.35)",
                "circle-stroke-width": [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    2,
                    0,
                ],
                "circle-stroke-color": "#fcd34d",
            },
        }),
        spec: (src, id) => ({
            id,
            type: "symbol",
            source: src,
            "source-layer": "user_pois",
            minzoom: 10,
            layout: {
                "icon-image": matchExpr(
                    "category",
                    poiIconRepository.getUserIconMatch(),
                    USER_PIN_PREFIX + "default"
                ),
                "icon-anchor": "center",
                "icon-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10, 0.85,
                    15, 1.0,
                    19, 1.15,
                ],
                "icon-allow-overlap": true,
                "text-field": [
                    "step",
                    ["zoom"],
                    "",
                    13,
                    ["coalesce", ["get", "name"], ""],
                ],
                "text-font": ["Noto Sans Regular"],
                "text-size": 11,
                "text-anchor": sideTextAnchorExpr(),
                "text-offset": sideTextOffsetExpr(1.0),
                "text-allow-overlap": false,
                "text-optional": true,
            },
            paint: {
                "text-color": "#ffffff",
                "text-halo-color": "#111827",
                "text-halo-width": 1.8,
            },
        }),
    },
];