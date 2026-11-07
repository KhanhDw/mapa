// api/streetview.ts
const BASE = "/api/streetview";

export interface LinkPosition {
    textureX: number;
    textureY: number;
}

export interface StreetViewImage {
    id: number;
    lng: number;
    lat: number;
    image_url: string;
    heading: number | null;
    captured_at: string | null;
    next_ids: number[];
    link_positions: LinkPosition[];
}

export interface StreetViewListResponse {
    items: StreetViewImage[];
    total: number;
}

/** Trường không gửi = giữ nguyên; `null` ở heading / captured_at = xóa giá trị. */
export interface StreetViewUpdateInput {
    heading?: number | null;
    lng?: number;
    lat?: number;
    captured_at?: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
        let msg = `Lỗi ${res.status}`;
        try {
            const body = await res.json();
            if (typeof body?.detail === "string") msg = body.detail;
            else if (Array.isArray(body?.detail) && body.detail[0]?.msg) msg = body.detail[0].msg;
        } catch {
            /* body không phải JSON */
        }
        throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export function fetchStreetViewImages(params: {
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<StreetViewListResponse> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    return request(`${BASE}/images?${qs}`);
}

export function updateStreetViewImage(
    id: number,
    input: StreetViewUpdateInput,
    apiKey: string,
): Promise<StreetViewImage> {
    return request(`${BASE}/image/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(input),
    });
}

export function deleteStreetViewImage(id: number, apiKey: string): Promise<void> {
    return request(`${BASE}/image/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey },
    });
}