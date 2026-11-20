
import { apiClient } from "./http/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ElectricPoleStatus = "good" | "warning" | "error";

export interface ElectricPole {
    id: number;
    pole_code: string;
    route?: string | null;
    status: ElectricPoleStatus;
    lng: number;
    lat: number;
    detail?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface ElectricPoleInput {
    pole_code: string;
    route?: string | null;
    status: ElectricPoleStatus;
    lng: number;
    lat: number;
    detail?: string | null;
}

export interface ElectricPoleListResponse {
    items: ElectricPole[];
    total: number;
}

export interface ElectricPoleQuery {
    search?: string;
    status?: ElectricPoleStatus;
    route?: string;
    limit?: number;
    offset?: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildQueryParams(
    query: Record<string, string | number | undefined>
): string {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        params.set(key, String(value));
    });

    const result = params.toString();
    return result ? `?${result}` : "";
}

function getWriteHeaders(apiKey?: string): HeadersInit {
    const key = apiKey;

    return key
        ? { "X-API-Key": key }
        : {};
}

function normalizeId(id: number | string): string {
    return encodeURIComponent(String(id));
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/electric-poles
 * Lấy danh sách trụ điện.
 */
export async function getElectricPoles(
    query: ElectricPoleQuery = {}
): Promise<ElectricPoleListResponse> {
    const params = buildQueryParams({
        search: query.search,
        status: query.status,
        route: query.route,
        limit: query.limit,
        offset: query.offset,
    });

    return apiClient.request<ElectricPoleListResponse>(
        `/api/electric-poles${params}`
    );
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/electric-poles/{id}
 * Lấy chi tiết trụ điện.
 */
export async function getElectricPole(
    id: number | string
): Promise<ElectricPole> {
    return apiClient.request<ElectricPole>(
        `/api/electric-poles/${normalizeId(id)}`
    );
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/electric-poles
 * Tạo trụ điện mới.
 */
export async function createElectricPole(
    data: ElectricPoleInput,
    apiKey?: string
): Promise<ElectricPole> {
    return apiClient.request<ElectricPole>(
        "/api/electric-poles",
        {
            method: "POST",
            headers: getWriteHeaders(apiKey),
            body: JSON.stringify(data),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * PUT /api/electric-poles/{id}
 * Cập nhật trụ điện.
 */
export async function updateElectricPole(
    id: number | string,
    data: ElectricPoleInput,
    apiKey?: string
): Promise<ElectricPole> {
    return apiClient.request<ElectricPole>(
        `/api/electric-poles/${normalizeId(id)}`,
        {
            method: "PUT",
            headers: getWriteHeaders(apiKey),
            body: JSON.stringify(data),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * DELETE /api/electric-poles/{id}
 * Xóa trụ điện.
 *
 * Backend có thể trả HTTP 204.
 */
export async function deleteElectricPole(
    id: number | string,
    apiKey?: string
): Promise<void> {
    return apiClient.request<void>(
        `/api/electric-poles/${normalizeId(id)}`,
        {
            method: "DELETE",
            headers: getWriteHeaders(apiKey),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

export const fetchElectricPoles = getElectricPoles;
export const fetchElectricPole = getElectricPole;
export const removeElectricPole = deleteElectricPole;
