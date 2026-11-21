export interface PoiItem {
    id: number | string;
    name: string | null;
    category: string;
    address?: string | null;
    phone?: string | null;
    description?: string | null;
    lng: number;
    lat: number;
    source: "user" | "system";
    created_at?: string | null;
}

export interface PoiListResponse {
    items: PoiItem[];
    total: number;
}