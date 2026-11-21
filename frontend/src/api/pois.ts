// frontend\src\api\pois.ts
import {
    deleteUserPoi as repositoryDeleteUserPoi,
    fetchSystemPois as repositoryFetchSystemPois,
    fetchUserPois as repositoryFetchUserPois,
    updateUserPoi as repositoryUpdateUserPoi,
} from "./repositories/PoiRepository";

import type {
    PoiListResponse,
    PoiWithSource,
    SystemPoiQuery,
    UpdateUserPoiInput,
    UserPoiQuery,
} from "./repositories/PoiRepository";



export type {
    PoiListResponse, PoiWithSource, SystemPoiQuery,
    UpdateUserPoiInput, UserPoiQuery
};

export type PoiSource = "user" | "system";

/**
 * Lấy danh sách POI người dùng.
 * GET /api/user-pois
 */
export async function fetchUserPois(
    query: UserPoiQuery = {}
): Promise<PoiListResponse<PoiWithSource>> {
    return repositoryFetchUserPois(query);
}

/**
 * Lấy danh sách POI hệ thống.
 * GET /api/system-pois
 */
export async function fetchSystemPois(
    query: SystemPoiQuery = {}
): Promise<PoiListResponse<PoiWithSource>> {
    return repositoryFetchSystemPois(query);
}

/**
 * Cập nhật POI người dùng.
 * PUT /api/user-pois/{id}
 */
export async function updateUserPoi(
    id: number | string,
    data: UpdateUserPoiInput
) {
    return repositoryUpdateUserPoi(id, data);
}

/**
 * Xóa POI người dùng.
 * DELETE /api/user-pois/{id}
 */
export async function deleteUserPoi(
    id: number | string
): Promise<void> {
    return repositoryDeleteUserPoi(id);
}