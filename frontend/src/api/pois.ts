const USER_POIS_BASE = "/api/user-pois";
const SYSTEM_POIS_BASE = "/api/system-pois";
export const DEFAULT_API_KEY = "test-key-123";

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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
        let msg = `Lỗi ${res.status}`;
        try {
            const body = await res.json();
            if (typeof body?.detail === "string") msg = body.detail;
        } catch {
            /* ignore */
        }
        throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export async function fetchUserPois(params: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
}): Promise<PoiListResponse> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.category) qs.set("category", params.category);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));

    const res = await request<PoiListResponse>(`${USER_POIS_BASE}?${qs}`);
    return {
        items: res.items.map((i) => ({ ...i, source: "user" as const })),
        total: res.total,
    };
}

export async function fetchSystemPois(params: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
}): Promise<PoiListResponse> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.category) qs.set("category", params.category);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));

    const res = await request<PoiListResponse>(`${SYSTEM_POIS_BASE}?${qs}`);
    return {
        items: res.items.map((i) => ({ ...i, source: "system" as const })),
        total: res.total,
    };
}

export async function updateUserPoi(
    id: number | string,
    input: Partial<PoiItem>,
    apiKey: string
): Promise<PoiItem> {
    const res = await request<PoiItem>(`${USER_POIS_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(input),
    });
    return { ...res, source: "user" };
}

export async function deleteUserPoi(id: number | string, apiKey: string): Promise<void> {
    return request<void>(`${USER_POIS_BASE}/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey },
    });
}