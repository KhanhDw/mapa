// api/repositories/PoiRepository.ts

import { apiClient } from "../../../core/api/ApiClient";
import type { PoiItem } from "../components/PoiManagementPanel/types/poi";
export type { PoiItem };
/**
 * POI được lấy từ backend.
 *
 * source là thuộc tính FE tự bổ sung để phân biệt dữ liệu,
 * không gửi thuộc tính này lên backend.
 */
export type PoiSource = "user" | "system";

export type PoiWithSource = PoiItem & {
    source: PoiSource;
};

export interface PoiListResponse<T> {
    items: T[];
    total: number;
}

export interface UserPoiQuery {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
}

export interface SystemPoiQuery {
    search?: string;
    fclass?: string;
    category?: string;
    has_name?: boolean;
    limit?: number;
    offset?: number;
}

export interface UpdateUserPoiInput {
    name?: string;
    category?: string;
    description?: string;
    lng?: number;
    lat?: number;
    address?: string;
}

function buildQueryParams(
    query: Record<string, string | number | boolean | undefined>
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

/**
 * Lấy danh sách POI do người dùng tạo.
 * GET /api/user-pois
 */
export async function fetchUserPois(
    query: UserPoiQuery = {}
): Promise<PoiListResponse<PoiWithSource>> {
    const params = buildQueryParams({
        search: query.search,
        category: query.category,
        limit: query.limit,
        offset: query.offset,
    });

    const response = await apiClient.request<
        PoiListResponse<PoiItem>
    >(`/api/user-pois${params}`);

    return {
        ...response,
        items: (response.items ?? []).map((item) => ({
            ...item,
            source: "user" as const,
        })),
    };
}

/**
 * Lấy danh sách POI hệ thống.
 * GET /api/system-pois
 */
export async function fetchSystemPois(
    query: SystemPoiQuery = {}
): Promise<PoiListResponse<PoiWithSource>> {
    const params = buildQueryParams({
        search: query.search,
        fclass: query.fclass,
        category: query.category,
        has_name: query.has_name,
        limit: query.limit,
        offset: query.offset,
    });

    const response = await apiClient.request<
        PoiListResponse<PoiItem>
    >(`/api/system-pois${params}`);

    return {
        ...response,
        items: (response.items ?? []).map((item) => ({
            ...item,
            source: "system" as const,
        })),
    };
}

/**
 * Cập nhật POI do người dùng tạo.
 * PUT /api/user-pois/{id}
 * Yêu cầu JWT Bearer.
 */
export async function updateUserPoi(
    id: number | string,
    data: UpdateUserPoiInput
): Promise<PoiItem> {
    return apiClient.request<PoiItem>(
        `/api/user-pois/${encodeURIComponent(String(id))}`,
        {
            method: "PUT",
            body: JSON.stringify(data),
        }
    );
}

/**
 * Xóa POI do người dùng tạo.
 * DELETE /api/user-pois/{id}
 * Yêu cầu JWT Bearer.
 */
export async function deleteUserPoi(
    id: number | string
): Promise<void> {
    await apiClient.request<void>(
        `/api/user-pois/${encodeURIComponent(String(id))}`,
        {
            method: "DELETE",
        }
    );
}
