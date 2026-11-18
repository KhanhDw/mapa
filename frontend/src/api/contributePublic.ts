
import { apiClient } from "./http/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface PublicPoiRequest {
    name: string;
    category?: string;
    description?: string;
    address?: string;
    lng: number;
    lat: number;
    [key: string]: unknown;
}

export interface PublicPoiResponse {
    id: number;
    name?: string;
    category?: string;
    description?: string;
    address?: string;
    lng?: number;
    lat?: number;
    [key: string]: unknown;
}

export interface PublicPhotoResponse {
    id?: number;
    poi_id?: number;
    file_path?: string;
    url?: string;
    filename?: string;
    [key: string]: unknown;
}

export interface PublicPanoramaResponse {
    id?: number;
    file_path?: string;
    url?: string;
    filename?: string;
    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeId(id: number | string): string {
    return encodeURIComponent(String(id));
}

/* -------------------------------------------------------------------------- */
/* Public POI                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/contribute/poi
 * Tạo POI công khai.
 * Không yêu cầu API key.
 */
export async function createPublicPoi(
    data: PublicPoiRequest
): Promise<PublicPoiResponse> {
    return apiClient.request<PublicPoiResponse>(
        "/api/contribute/poi",
        {
            method: "POST",
            body: JSON.stringify(data),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Public POI Photos                                                          */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/contribute/photos/{poi_id}
 * Upload ảnh cho POI công khai.
 *
 * Không đặt Content-Type thủ công để trình duyệt
 * tự thiết lập multipart boundary.
 */
export async function uploadPublicPoiPhoto(
    poiId: number | string,
    file: File
): Promise<PublicPhotoResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient.request<PublicPhotoResponse>(
        `/api/contribute/photos/${normalizeId(poiId)}`,
        {
            method: "POST",
            body: formData,
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Public Panorama                                                            */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/contribute/panorama
 * Upload panorama công khai.
 */
export async function uploadPublicPanorama(
    file: File,
    data: {
        lng: number;
        lat: number;
        heading?: number;
        pitch?: number;
        filename?: string;
        subdir?: string;
        captured_at?: string;
    }
): Promise<PublicPanoramaResponse> {
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

    return apiClient.request<PublicPanoramaResponse>(
        "/api/contribute/panorama",
        {
            method: "POST",
            body: formData,
        }
    );
}
