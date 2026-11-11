const BASE = "/api/streetview";
export const DEFAULT_API_KEY = "test-key-123";

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
    next_ids: number[];
    link_positions: LinkPosition[];
    captured_at: string | null;
}

export interface StreetViewNearbyImage extends StreetViewImage {
    distance_meters: number;
}

export interface StreetViewListResponse {
    items: StreetViewImage[];
    total: number;
}

export interface StreetViewUpdateInput {
    heading?: number | null;
    lng?: number;
    lat?: number;
    captured_at?: string | null;
    next_ids?: number[];
    link_positions?: LinkPosition[];
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

export async function fetchStreetViewImages(params: {
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<StreetViewListResponse> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));

    const res = await fetch(`${BASE}/images?${qs}`, { cache: "no-store" });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Tải danh sách Street View thất bại (HTTP ${res.status}) ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { items?: unknown[]; total?: number };
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems.map(normalizeImage);

    return {
        items,
        total: typeof data.total === "number" ? data.total : items.length,
    };
}

export async function fetchNearbyStreetViewImages(params: {
    lng: number;
    lat: number;
    radius?: number;
    exclude_id?: number;
    limit?: number;
}): Promise<StreetViewNearbyImage[]> {
    const qs = new URLSearchParams({
        lng: String(params.lng),
        lat: String(params.lat),
    });
    if (params.radius != null) qs.set("radius", String(params.radius));
    if (params.exclude_id != null) qs.set("exclude_id", String(params.exclude_id));
    if (params.limit != null) qs.set("limit", String(params.limit));

    const res = await fetch(`${BASE}/nearby?${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Lỗi tải ảnh lân cận (${res.status})`);
    const data = (await res.json()) as { items?: unknown[] };
    return (data.items || []).map((r) => {
        const norm = normalizeImage(r);
        return {
            ...norm,
            distance_meters: typeof (r as any).distance_meters === "number" ? (r as any).distance_meters : 0,
        };
    });
}

export function updateStreetViewImage(
    id: number,
    input: StreetViewUpdateInput,
    apiKey: string = DEFAULT_API_KEY,
): Promise<StreetViewImage> {
    return request(`${BASE}/image/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey || DEFAULT_API_KEY },
        body: JSON.stringify(input),
    });
}

export function deleteStreetViewImage(id: number, apiKey: string = DEFAULT_API_KEY): Promise<void> {
    return request(`${BASE}/image/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey || DEFAULT_API_KEY },
    });
}

export interface UploadPanoramaPayload {
    lng: number;
    lat: number;
    heading?: number | null;
    file: File;
}

export async function uploadStreetViewImage(
    payload: UploadPanoramaPayload,
    apiKey: string = DEFAULT_API_KEY,
): Promise<{ id: number }> {
    const formData = new FormData();
    formData.append("lng", String(payload.lng));
    formData.append("lat", String(payload.lat));
    if (payload.heading != null) formData.append("heading", String(payload.heading));
    formData.append("file", payload.file);

    const res = await fetch("/api/user-panoramas", {
        method: "POST",
        headers: { "X-API-Key": apiKey || DEFAULT_API_KEY },
        body: formData,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail || "Không thể tải lên ảnh panorama");
    }
    return res.json();
}

function normalizeImage(raw: unknown): StreetViewImage {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
        id: Number(r.id ?? 0),
        lng: Number(r.lng ?? 0),
        lat: Number(r.lat ?? 0),
        image_url: String(r.image_url ?? ""),
        heading: typeof r.heading === "number" ? r.heading : null,
        next_ids: Array.isArray(r.next_ids) ? (r.next_ids as number[]) : [],
        link_positions: Array.isArray(r.link_positions)
            ? (r.link_positions as LinkPosition[])
            : [],
        captured_at: typeof r.captured_at === "string" ? r.captured_at : null,
    };
}