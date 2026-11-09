import { API_BASE } from "../config";

export type SearchResultKind = "place" | "road";

export type SearchLineGeometry =
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "MultiLineString"; coordinates: [number, number][][] };

export interface SearchResult {
    id: string | number;
    name: string;
    kind: SearchResultKind;
    category?: string | null;
    address?: string | null;
    lat: number;
    lng: number;
    source: "osm" | "user";
    geometry?: SearchLineGeometry | null;
    bbox?: [number, number, number, number] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isCoordinate(value: unknown): value is [number, number] {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        typeof value[0] === "number" &&
        Number.isFinite(value[0]) &&
        typeof value[1] === "number" &&
        Number.isFinite(value[1])
    );
}

function isLineGeometry(value: unknown): value is SearchLineGeometry {
    if (!isRecord(value) || !Array.isArray(value.coordinates)) return false;
    if (value.type === "LineString") {
        return value.coordinates.every(isCoordinate);
    }
    if (value.type === "MultiLineString") {
        return value.coordinates.every(
            (line) => Array.isArray(line) && line.every(isCoordinate)
        );
    }
    return false;
}

function isSearchResult(value: unknown): value is SearchResult {
    if (!isRecord(value)) return false;
    const hasValidBase =
        (typeof value.id === "string" || typeof value.id === "number") &&
        typeof value.name === "string" &&
        (value.kind === "place" || value.kind === "road") &&
        (value.source === "osm" || value.source === "user") &&
        typeof value.lng === "number" &&
        Number.isFinite(value.lng) &&
        typeof value.lat === "number" &&
        Number.isFinite(value.lat);
    if (!hasValidBase) return false;
    if (value.kind === "road") {
        return isLineGeometry(value.geometry) && Array.isArray(value.bbox);
    }
    return true;
}

export async function searchMap(
    query: string,
    signal?: AbortSignal
): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(
        `${API_BASE.replace(/\/+$/, "")}/api/search?${params}`,
        { signal }
    );
    if (!response.ok) {
        const body = await response.text();
        let message = `Tìm kiếm thất bại (HTTP ${response.status})`;
        if (body) {
            try {
                const parsed: { detail?: unknown } = JSON.parse(body);
                if (typeof parsed.detail === "string") message = parsed.detail;
            } catch {
                message = body;
            }
        }
        throw new Error(message);
    }

    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.results)) {
        throw new Error("Phản hồi tìm kiếm không hợp lệ");
    }
    if (!body.results.every(isSearchResult)) {
        throw new Error("Dữ liệu kết quả tìm kiếm không hợp lệ");
    }
    return body.results;
}
