// frontend\src\api\poiManagement.ts

import { apiClient } from "../../../core/api/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface UserPoiManagement {
    id: number;
    name: string;
    category?: string | null;
    description?: string | null;
    address?: string | null;
    lng: number;
    lat: number;
    created_at?: string | null;
    updated_at?: string | null;
    photos?: UserPoiPhoto[];
    [key: string]: unknown;
}

export interface UserPoiPhoto {
    id: number;
    poi_id?: number;
    file_path?: string;
    url?: string;
    filename?: string;
    created_at?: string;
    [key: string]: unknown;
}

export interface UserPoiListResponse {
    items: UserPoiManagement[];
    total: number;
}

export interface UpdateUserPoiRequest {
    name?: string;
    category?: string;
    description?: string;
    address?: string;
    lng?: number;
    lat?: number;
}

export interface UpdateUserPoiResponse {
    poi?: UserPoiManagement;
    [key: string]: unknown;
}

export interface SystemPoi {
    id: number | string;
    name?: string | null;
    category?: string | null;
    fclass?: string | null;
    description?: string | null;
    address?: string | null;
    lng?: number;
    lat?: number;
    [key: string]: unknown;
}

export interface SystemPoiListResponse {
    items: SystemPoi[];
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildQueryParams(
    query: Record<string, string | number | boolean | undefined>
): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") {
            continue;
        }

        params.set(key, String(value));
    }

    const result = params.toString();
    return result ? `?${result}` : "";
}



function normalizeId(id: number | string): string {
    return encodeURIComponent(String(id));
}

/* -------------------------------------------------------------------------- */
/* User POIs                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/user-pois
 * Lấy danh sách POI do người dùng tạo.
 */
export async function getUserPois(
    query: UserPoiQuery = {}
): Promise<UserPoiListResponse> {
    const params = buildQueryParams({
        search: query.search,
        category: query.category,
        limit: query.limit,
        offset: query.offset,
    });

    return apiClient.request<UserPoiListResponse>(
        `/api/user-pois${params}`
    );
}

/**
 * PUT /api/user-pois/{id}
 * Cập nhật POI người dùng.
 */
export async function updateUserPoi(
    id: number | string,
    data: UpdateUserPoiRequest
): Promise<UserPoiManagement> {
    return apiClient.request<UserPoiManagement>(
        `/api/user-pois/${normalizeId(id)}`,
        {
            method: "PUT",
            body: JSON.stringify(data),
        }
    );
}

/**
 * DELETE /api/user-pois/{id}
 * Xóa POI người dùng.
 */
export async function deleteUserPoi(
    id: number | string
): Promise<void> {
    return apiClient.request<void>(
        `/api/user-pois/${normalizeId(id)}`,
        {
            method: "DELETE",
        }
    );
}

/**
 * DELETE /api/user-pois/{id}/photos/{photo_id}
 * Xóa ảnh của POI người dùng.
 */
export async function deleteUserPoiPhoto(
    poiId: number | string,
    photoId: number | string
): Promise<void> {
    return apiClient.request<void>(
        `/api/user-pois/${normalizeId(poiId)}/photos/${normalizeId(photoId)}`,
        {
            method: "DELETE",
        }
    );
}

/* -------------------------------------------------------------------------- */
/* System POIs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/system-pois
 * Lấy danh sách POI hệ thống.
 * Đây là API chỉ đọc, không cần API key.
 */
export async function getSystemPois(
    query: SystemPoiQuery = {}
): Promise<SystemPoiListResponse> {
    const params = buildQueryParams({
        search: query.search,
        fclass: query.fclass,
        category: query.category,
        has_name: query.has_name,
        limit: query.limit,
        offset: query.offset,
    });

    return apiClient.request<SystemPoiListResponse>(
        `/api/system-pois${params}`
    );
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Các alias giúp những component đang sử dụng tên hàm fetch
 * có thể tiếp tục gọi API.
 */
export const fetchUserPois = getUserPois;
export const fetchSystemPois = getSystemPois;
export const removeUserPoi = deleteUserPoi;
export const removeUserPoiPhoto = deleteUserPoiPhoto;
