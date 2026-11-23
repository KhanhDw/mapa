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
export const USER_PIN_PREFIX = "user-pin-";

const CIRCLE_SIZE = 24;

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

const RAW_CLASS_TO_GLYPH: Record<string, PoiGlyph> = {
    restaurant: "restaurant",
    fast_food: "restaurant",
    food_court: "restaurant",
    cafe: "cafe",
    bar: "cafe",
    pub: "cafe",
    biergarten: "cafe",
    hotel: "hotel",
    motel: "hotel",
    hostel: "hotel",
    guest_house: "hotel",
    guesthouse: "hotel",
    chalet: "hotel",
    camp_site: "hotel",
    caravan_site: "hotel",
    school: "school",
    university: "school",
    college: "school",
    kindergarten: "school",
    library: "school",
    hospital: "hospital",
    clinic: "hospital",
    doctors: "hospital",
    dentist: "hospital",
    pharmacy: "hospital",
    veterinary: "hospital",
    nursing_home: "hospital",
    supermarket: "shop",
    convenience: "shop",
    mall: "shop",
    department_store: "shop",
    clothes: "shop",
    bakery: "shop",
    butcher: "shop",
    greengrocer: "shop",
    kiosk: "shop",
    market_place: "shop",
    bookshop: "shop",
    shoe_shop: "shop",
    furniture_shop: "shop",
    jeweller: "shop",
    mobile_phone_shop: "shop",
    hairdresser: "shop",
    beauty_shop: "shop",
    bank: "bank",
    atm: "bank",
    post_office: "bank",
    police: "bank",
    fire_station: "bank",
    town_hall: "bank",
    courthouse: "bank",
    fuel: "fuel",
    parking: "fuel",
    charging_station: "fuel",
    car_rental: "fuel",
    bicycle_rental: "fuel",
    attraction: "hotel",
    museum: "hotel",
    zoo: "hotel",
    theme_park: "hotel",
    viewpoint: "hotel",
    monument: "hotel",
    tourist_info: "hotel",
};

export class PoiIconRepository {
    private static instance: PoiIconRepository | null = null;

    private readonly iconMatch: Record<string, string>;
    private readonly userIconMatch: Record<string, string>;

    private constructor() {
        this.iconMatch = Object.fromEntries(
            Object.entries(RAW_CLASS_TO_GLYPH).map(([key, glyph]) => [
                key,
                `${POI_ICON_PREFIX}${glyph}`,
            ])
        );

        this.userIconMatch = Object.fromEntries(
            Object.entries(RAW_CLASS_TO_GLYPH).map(([key, glyph]) => [
                key,
                `${USER_PIN_PREFIX}${glyph}`,
            ])
        );
    }

    public static getInstance(): PoiIconRepository {
        if (!PoiIconRepository.instance) {
            PoiIconRepository.instance = new PoiIconRepository();
        }
        return PoiIconRepository.instance;
    }

    public getIconMatch(): Record<string, string> {
        return this.iconMatch;
    }

    public getUserIconMatch(): Record<string, string> {
        return this.userIconMatch;
    }

    public registerStandardIcons(map: MapLibreMap): void {
        const dpr = window.devicePixelRatio || 1;
        for (const glyph of ALL_GLYPHS) {
            const id = `${POI_ICON_PREFIX}${glyph}`;
            if (map.hasImage(id)) continue;
            map.addImage(id, this.createSmallCircleIcon(glyph, CIRCLE_SIZE), {
                pixelRatio: dpr,
            });
        }
    }

    public registerPinIcons(map: MapLibreMap): void {
        const dpr = window.devicePixelRatio || 1;
        for (const glyph of ALL_GLYPHS) {
            const id = `${USER_PIN_PREFIX}${glyph}`;
            if (map.hasImage(id)) continue;
            map.addImage(id, this.createSmallCircleIcon(glyph, CIRCLE_SIZE), {
                pixelRatio: dpr,
            });
        }
    }

    private drawGlyph(
        ctx: CanvasRenderingContext2D,
        glyph: PoiGlyph,
        c: number,
        half: number
    ): void {
        if (glyph === "default") {
            ctx.beginPath();
            ctx.arc(c, c, half * 0.42, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        const path24 = SVG_PATHS[glyph];
        if (!path24) return;

        const path = new Path2D(path24);
        const scale = (2 * half) / 24;

        ctx.lineWidth = 2.1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.save();
        ctx.translate(c - half, c - half);
        ctx.scale(scale, scale);
        ctx.stroke(path);
        ctx.restore();
    }

    private createSmallCircleIcon(glyph: PoiGlyph, size = CIRCLE_SIZE): ImageData {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpr, dpr);

        const c = size / 2;
        const strokeWidth = 1.8;
        const radius = c - strokeWidth / 2 - 0.5;

        ctx.beginPath();
        ctx.arc(c, c, radius, 0, Math.PI * 2);
        ctx.fillStyle = GLYPH_COLORS[glyph];
        ctx.fill();
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.fillStyle = "#ffffff";
        this.drawGlyph(ctx, glyph, c, radius * 0.58);

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

export const poiIconRepository = PoiIconRepository.getInstance();