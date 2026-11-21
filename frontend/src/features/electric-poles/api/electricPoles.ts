
import { apiClient } from "../../../core/api/ApiClient";

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
 * Tạo trụ điện mới. Yêu cầu JWT Bearer.
 */
export async function createElectricPole(
    data: ElectricPoleInput
): Promise<ElectricPole> {
    return apiClient.request<ElectricPole>(
        "/api/electric-poles",
        {
            method: "POST",
            body: JSON.stringify(data),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * PUT /api/electric-poles/{id}
 * Cập nhật trụ điện. Yêu cầu JWT Bearer.
 */
export async function updateElectricPole(
    id: number | string,
    data: ElectricPoleInput
): Promise<ElectricPole> {
    return apiClient.request<ElectricPole>(
        `/api/electric-poles/${normalizeId(id)}`,
        {
            method: "PUT",
            body: JSON.stringify(data),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * DELETE /api/electric-poles/{id}
 * Xóa trụ điện. Yêu cầu JWT Bearer.
 *
 * Backend có thể trả HTTP 204.
 */
export async function deleteElectricPole(
    id: number | string
): Promise<void> {
    return apiClient.request<void>(
        `/api/electric-poles/${normalizeId(id)}`,
        {
            method: "DELETE",
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

export const fetchElectricPoles = getElectricPoles;
export const fetchElectricPole = getElectricPole;
export const removeElectricPole = deleteElectricPole;
