
import { apiClient } from "../../../core/api/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SearchSource = "admin" | "osm" | "user";

export type SearchKind = "admin" | "place" | "road";

export interface SearchGeometry {
    type: "Point" | "LineString" | "MultiLineString" | string;
    coordinates: number[] | number[][] | number[][][];
}



export interface SearchResult {
    id: number | string;
    kind: SearchKind;
    source: SearchSource;

    name?: string | null;
    display_name?: string | null;
    category?: string | null;
    description?: string | null;
    address?: string | null;

    lng: number;
    lat: number;

    geometry?: SearchGeometry | null;
    bbox?: [number, number, number, number] | null;

    [key: string]: unknown;
}

export interface SearchResponse {
     results: SearchResult[];
}

export interface SearchParams {
    q: string;
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/search?q=...
 *
 * Tìm kiếm:
 * - Địa giới hành chính (admin)
 * - POI hệ thống (osm)
 * - POI người dùng (user)
 * - Đường giao thông (road)
 */
export async function searchPlaces(
    params: SearchParams
): Promise<SearchResponse> {
    const q = params.q.trim();

    if (!q) {
        return {
            results: [],
        };
    }

    const query = new URLSearchParams({
        q,
    });

    return apiClient.request<SearchResponse>(
        `/api/search?${query.toString()}`
    );
}

/**
 * Hàm tiện ích cho component truyền trực tiếp chuỗi tìm kiếm.
 */
export async function search(
    q: string
): Promise<SearchResponse> {
    return searchPlaces({ q });
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

export const fetchSearchResults = searchPlaces;
export const searchMap = search;
