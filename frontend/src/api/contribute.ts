
import { apiClient } from "./http/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface UserPoiRequest {
    name: string;
    category?: string;
    description?: string;
    address?: string;
    lng: number;
    lat: number;
    [key: string]: unknown;
}

export interface UserPoiResponse {
    id: number;
    name?: string;
    category?: string;
    description?: string;
    address?: string;
    lng?: number;
    lat?: number;
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

export interface UploadPhotoResponse {
    id?: number;
    poi_id?: number;
    file_path?: string;
    url?: string;
    filename?: string;
    [key: string]: unknown;
}

export interface UploadPanoramaResponse {
    id?: number;
    file_path?: string;
    url?: string;
    filename?: string;
    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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
/* User POI                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/user-pois
 * Tạo POI người dùng.
 */
export async function createUserPoi(
    data: UserPoiRequest,
    apiKey?: string
): Promise<UserPoiResponse> {
    return apiClient.request<UserPoiResponse>(
        "/api/user-pois",
        {
            method: "POST",
            headers: getWriteHeaders(apiKey),
            body: JSON.stringify(data),
        }
    );
}

/**
 * GET /api/user-pois/{id}
 * Lấy chi tiết POI người dùng.
 */
export async function getUserPoi(
    id: number | string
): Promise<UserPoiResponse> {
    return apiClient.request<UserPoiResponse>(
        `/api/user-pois/${normalizeId(id)}`
    );
}

/* -------------------------------------------------------------------------- */
/* POI Photos                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/user-pois/{id}/photos
 * Upload ảnh cho POI.
 *
 * Không tự đặt Content-Type vì trình duyệt cần tự tạo
 * multipart/form-data boundary.
 */
export async function uploadUserPoiPhoto(
    poiId: number | string,
    file: File,
    apiKey?: string
): Promise<UploadPhotoResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient.request<UploadPhotoResponse>(
        `/api/user-pois/${normalizeId(poiId)}/photos`,
        {
            method: "POST",
            headers: getWriteHeaders(apiKey),
            body: formData,
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Panorama                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/user-panoramas
 * Upload panorama 360 độ.
 */
export async function uploadUserPanorama(
    file: File,
    data: {
        lng: number;
        lat: number;
        heading?: number;
        pitch?: number;
        filename?: string;
        subdir?: string;
        captured_at?: string;
    },
    apiKey?: string
): Promise<UploadPanoramaResponse> {
    const formData = new FormData();

    formData.append("file", file);
    formData.append("lng", String(data.lng));
    formData.append("lat", String(data.lat));

    if (data.heading !== undefined) {
        formData.append("heading", String(data.heading));
    }

    if (data.pitch !== undefined) {
        formData.append("pitch", String(data.pitch));
    }

    if (data.filename) {
        formData.append("filename", data.filename);
    }

    if (data.subdir) {
        formData.append("subdir", data.subdir);
    }

    if (data.captured_at) {
        formData.append("captured_at", data.captured_at);
    }

    return apiClient.request<UploadPanoramaResponse>(
        "/api/user-panoramas",
        {
            method: "POST",
            headers: getWriteHeaders(apiKey),
            body: formData,
        }
    );
}
