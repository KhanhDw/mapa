// Sinh icon POI (canvas) runtime: vòng tròn màu + glyph trắng ở giữa.
// Không phụ thuộc file sprite, emoji hay asset ngoài.

import type { Map as MapLibreMap } from "maplibre-gl";

export type PoiGlyph =
    | "restaurant"
    | "cafe"
    | "hotel"
    | "school"
    | "hospital"
    | "shop"
    | "bank"
    | "fuel"
    | "default";

export const POI_ICON_PREFIX = "poi-icon-";

const GLYPH_COLORS: Record<PoiGlyph, string> = {
    restaurant: "#ef4444",
    cafe: "#b45309",
    hotel: "#3b82f6",
    school: "#8b5cf6",
    hospital: "#dc2626",
    shop: "#10b981",
    bank: "#0ea5e9",
    fuel: "#f59e0b",
    default: "#6b7280",
};

/**
 * Map fclass (OSM class) hoặc category (user POI) → icon ID.
 * Key = giá trị của property trong PBF (clean.pois dùng fclass,
 * user_data.pois dùng category).
 */
export const ICON_MATCH: Record<string, string> = {
    // ===== Ăn uống =====
    restaurant: POI_ICON_PREFIX + "restaurant",
    fast_food: POI_ICON_PREFIX + "restaurant",
    food_court: POI_ICON_PREFIX + "restaurant",
    cafe: POI_ICON_PREFIX + "cafe",
    bar: POI_ICON_PREFIX + "cafe",
    pub: POI_ICON_PREFIX + "cafe",
    biergarten: POI_ICON_PREFIX + "cafe",

    // ===== Lưu trú =====
    hotel: POI_ICON_PREFIX + "hotel",
    motel: POI_ICON_PREFIX + "hotel",
    hostel: POI_ICON_PREFIX + "hotel",
    guest_house: POI_ICON_PREFIX + "hotel",
    guesthouse: POI_ICON_PREFIX + "hotel",
    chalet: POI_ICON_PREFIX + "hotel",
    camp_site: POI_ICON_PREFIX + "hotel",
    caravan_site: POI_ICON_PREFIX + "hotel",

    // ===== Giáo dục =====
    school: POI_ICON_PREFIX + "school",
    university: POI_ICON_PREFIX + "school",
    college: POI_ICON_PREFIX + "school",
    kindergarten: POI_ICON_PREFIX + "school",
    library: POI_ICON_PREFIX + "school",

    // ===== Y tế =====
    hospital: POI_ICON_PREFIX + "hospital",
    clinic: POI_ICON_PREFIX + "hospital",
    doctors: POI_ICON_PREFIX + "hospital",
    dentist: POI_ICON_PREFIX + "hospital",
    pharmacy: POI_ICON_PREFIX + "hospital",
    veterinary: POI_ICON_PREFIX + "hospital",
    nursing_home: POI_ICON_PREFIX + "hospital",

    // ===== Mua sắm =====
    supermarket: POI_ICON_PREFIX + "shop",
    convenience: POI_ICON_PREFIX + "shop",
    mall: POI_ICON_PREFIX + "shop",
    department_store: POI_ICON_PREFIX + "shop",
    clothes: POI_ICON_PREFIX + "shop",
    bakery: POI_ICON_PREFIX + "shop",
    butcher: POI_ICON_PREFIX + "shop",
    greengrocer: POI_ICON_PREFIX + "shop",
    kiosk: POI_ICON_PREFIX + "shop",
    market_place: POI_ICON_PREFIX + "shop",
    bookshop: POI_ICON_PREFIX + "shop",
    shoe_shop: POI_ICON_PREFIX + "shop",
    furniture_shop: POI_ICON_PREFIX + "shop",
    jeweller: POI_ICON_PREFIX + "shop",
    mobile_phone_shop: POI_ICON_PREFIX + "shop",
    hairdresser: POI_ICON_PREFIX + "shop",
    beauty_shop: POI_ICON_PREFIX + "shop",

    // ===== Tài chính / dịch vụ =====
    bank: POI_ICON_PREFIX + "bank",
    atm: POI_ICON_PREFIX + "bank",
    post_office: POI_ICON_PREFIX + "bank",
    police: POI_ICON_PREFIX + "bank",
    fire_station: POI_ICON_PREFIX + "bank",
    town_hall: POI_ICON_PREFIX + "bank",
    courthouse: POI_ICON_PREFIX + "bank",

    // ===== Giao thông =====
    fuel: POI_ICON_PREFIX + "fuel",
    parking: POI_ICON_PREFIX + "fuel",
    charging_station: POI_ICON_PREFIX + "fuel",
    car_rental: POI_ICON_PREFIX + "fuel",
    bicycle_rental: POI_ICON_PREFIX + "fuel",

    // ===== Du lịch (fallback về hotel icon — ngôi nhà) =====
    attraction: POI_ICON_PREFIX + "hotel",
    museum: POI_ICON_PREFIX + "hotel",
    zoo: POI_ICON_PREFIX + "hotel",
    theme_park: POI_ICON_PREFIX + "hotel",
    viewpoint: POI_ICON_PREFIX + "hotel",
    monument: POI_ICON_PREFIX + "hotel",
    tourist_info: POI_ICON_PREFIX + "hotel",
};

/** SVG path (24×24 viewBox) — vẽ bằng Path2D, stroke 2px */
const SVG_PATHS: Record<PoiGlyph, string> = {
    restaurant:
        "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
    cafe:
        "M17 8h1a4 4 0 1 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z M6 2v2 M10 2v2 M14 2v2",
    hotel:
        "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8 M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4 M2 18h20 M6 18v-4 M18 18v-4",
    school:
        "M22 10v6 M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5",
    hospital: "M12 5v14 M5 12h14",
    shop:
        "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
    bank:
        "M3 22h18 M3 10h18 M12 2 2 7v3h20V7z M5 21v-8 M19 21v-8 M9 21v-8 M15 21v-8",
    fuel:
        "M3 22h12 M4 9h10 M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18 M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5",
    default: "",
};

const ALL_GLYPHS: PoiGlyph[] = [
    "restaurant",
    "cafe",
    "hotel",
    "school",
    "hospital",
    "shop",
    "bank",
    "fuel",
    "default",
];

function drawGlyph(
    ctx: CanvasRenderingContext2D,
    glyph: PoiGlyph,
    c: number,
    half: number
): void {
    if (glyph === "default") {
        ctx.beginPath();
        ctx.arc(c, c, half * 0.4, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    const path24 = SVG_PATHS[glyph];
    if (!path24) return;

    const p = new Path2D(path24);
    const scale = (2 * half) / 24;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.save();
    ctx.translate(c - half, c - half);
    ctx.scale(scale, scale);
    ctx.stroke(p);
    ctx.restore();
}

/** Vẽ 1 icon thành ImageData — size tính bằng CSS px */
export function createPoiIcon(glyph: PoiGlyph, size = 36): ImageData {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const c = size / 2;

    // Vòng tròn nền
    ctx.beginPath();
    ctx.arc(c, c, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = GLYPH_COLORS[glyph];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Glyph trắng bên trong
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    drawGlyph(ctx, glyph, c, size * 0.22);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Đăng ký toàn bộ icon POI vào map.
 * Idempotent — gọi nhiều lần an toàn (guard hasImage).
 */
export function registerPoiIcons(map: MapLibreMap): void {
    const dpr = window.devicePixelRatio || 1;
    for (const g of ALL_GLYPHS) {
        const id = POI_ICON_PREFIX + g;
        if (map.hasImage(id)) continue;
        const imageData = createPoiIcon(g, 36);
        map.addImage(id, imageData, { pixelRatio: dpr });
    }
}