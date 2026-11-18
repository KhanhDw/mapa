
import { apiClient } from "./http/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface StreetViewPoint {
    id: number | string;
    lng: number;
    lat: number;
    heading?: number | null;
    pitch?: number | null;
    [key: string]: unknown;
}

export interface StreetViewImage {
    id: number | string;
    file_path?: string | null;
    filename?: string | null;
    url?: string | null;
    lng?: number;
    lat?: number;
    heading?: number | null;
    pitch?: number | null;
    captured_at?: string | null;
    created_at?: string | null;
    [key: string]: unknown;
}

export interface StreetViewListResponse {
    items: StreetViewImage[];
    total: number;
}

export interface StreetViewPointsResponse {
    items: StreetViewPoint[];
    total?: number;
}

export interface StreetViewNearbyResponse {
    items: StreetViewImage[];
    total?: number;
}

export interface StreetViewUpdate {
    heading?: number;
    pitch?: number;
    captured_at?: string | null;
    filename?: string;
}

export interface StreetViewBatchUpdateItem {
    id: number | string;
    heading?: number;
    pitch?: number;
    captured_at?: string | null;
    filename?: string;
}

export interface StreetViewUploadData {
    lng: number;
    lat: number;
    heading?: number;
    pitch?: number;
    filename?: string;
    subdir?: string;
    captured_at?: string;
}

export interface StreetViewUploadResponse {
    id?: number | string;
    file_path?: string;
    filename?: string;
    url?: string;
    lng?: number;
    lat?: number;
    heading?: number;
    pitch?: number;
    captured_at?: string;
    created_at?: string;
    [key: string]: unknown;
}

export type StreetViewQueryValue = string | number | boolean | undefined;

export type StreetViewQuery = Record<string, StreetViewQueryValue>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildQueryParams(query: StreetViewQuery = {}): string {
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
    const key = apiKey || import.meta.env.VITE_WRITE_API_KEY;

    return key
        ? { "X-API-Key": key }
        : {};
}

function normalizeId(id: number | string): string {
    return encodeURIComponent(String(id));
}

/* -------------------------------------------------------------------------- */
/* Read APIs                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/streetview/points
 * Lấy các điểm Street View theo vùng bản đồ.
 */
export async function getStreetViewPoints(
    query: StreetViewQuery = {}
): Promise<StreetViewPointsResponse> {
    const params = buildQueryParams(query);

    return apiClient.request<StreetViewPointsResponse>(
        `/api/streetview/points${params}`
    );
}

/**
 * GET /api/streetview/images
 * Lấy danh sách ảnh Street View.
 */
export async function getStreetViewImages(
    query: StreetViewQuery = {}
): Promise<StreetViewListResponse> {
    const params = buildQueryParams(query);

    return apiClient.request<StreetViewListResponse>(
        `/api/streetview/images${params}`
    );
}

/**
 * GET /api/streetview/nearby
 * Tìm ảnh Street View gần một tọa độ.
 */
export async function getNearbyStreetView(
    query: StreetViewQuery
): Promise<StreetViewNearbyResponse> {
    const params = buildQueryParams(query);

    return apiClient.request<StreetViewNearbyResponse>(
        `/api/streetview/nearby${params}`
    );
}

/**
 * GET /api/streetview/image/{id}
 * Lấy thông tin một ảnh Street View.
 */
export async function getStreetViewImage(
    id: number | string
): Promise<StreetViewImage> {
    return apiClient.request<StreetViewImage>(
        `/api/streetview/image/${normalizeId(id)}`
    );
}

/* -------------------------------------------------------------------------- */
/* Update APIs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * PUT /api/streetview/image/{id}
 * Cập nhật thông tin ảnh Street View.
 *
 * Không gửi next_ids hoặc link_positions vì backend
 * không hỗ trợ các trường này.
 */
export async function updateStreetViewImage(
    id: number | string,
    data: StreetViewUpdate,
    apiKey?: string
): Promise<StreetViewImage> {
    return apiClient.request<StreetViewImage>(
        `/api/streetview/image/${normalizeId(id)}`,
        {
            method: "PUT",
            headers: getWriteHeaders(apiKey),
            body: JSON.stringify(data),
        }
    );
}

/**
 * PATCH /api/streetview/batch-update
 * Cập nhật nhiều ảnh Street View.
 */
export async function batchUpdateStreetViewImages(
    updates: StreetViewBatchUpdateItem[],
    apiKey?: string
): Promise<unknown> {
    return apiClient.request<unknown>(
        "/api/streetview/batch-update",
        {
            method: "PATCH",
            headers: getWriteHeaders(apiKey),
            body: JSON.stringify(updates),
        }
    );
}

/**
 * DELETE /api/streetview/image/{id}
 * Xóa ảnh Street View.
 */
export async function deleteStreetViewImage(
    id: number | string,
    apiKey?: string
): Promise<void> {
    return apiClient.request<void>(
        `/api/streetview/image/${normalizeId(id)}`,
        {
            method: "DELETE",
            headers: getWriteHeaders(apiKey),
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Upload                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/streetview/upload
 * Upload một ảnh panorama Street View.
 *
 * Các field multipart:
 * file, lng, lat, heading, pitch, filename, subdir, captured_at.
 */
export async function uploadStreetViewImage(
    file: File,
    data: StreetViewUploadData,
    apiKey?: string
): Promise<StreetViewUploadResponse> {
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

    return apiClient.request<StreetViewUploadResponse>(
        "/api/streetview/upload",
        {
            method: "POST",
            headers: getWriteHeaders(apiKey),
            body: formData,
        }
    );
}

/* -------------------------------------------------------------------------- */
/* Batch upload                                                               */
/* -------------------------------------------------------------------------- */

export interface StreetViewBatchUploadItem {
    file: File;
    data: StreetViewUploadData;
}

export interface StreetViewBatchUploadResult {
    index: number;
    success: boolean;
    data?: StreetViewUploadResponse;
    error?: string;
}

export interface StreetViewBatchUploadOptions {
    concurrency?: number;
    apiKey?: string;
    signal?: AbortSignal;
}

/**
 * Upload nhiều ảnh với giới hạn số request đồng thời.
 *
 * Mỗi ảnh được upload độc lập.
 * Một ảnh lỗi không làm dừng các ảnh còn lại.
 */
export async function uploadStreetViewBatch(
    files: StreetViewBatchUploadItem[],
    options: StreetViewBatchUploadOptions = {}
): Promise<StreetViewBatchUploadResult[]> {
    const concurrency = Math.max(
        1,
        Math.min(options.concurrency ?? 3, files.length || 1)
    );

    const results: StreetViewBatchUploadResult[] = new Array(files.length);

    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (true) {
            if (options.signal?.aborted) {
                return;
            }

            const index = nextIndex++;

            if (index >= files.length) {
                return;
            }

            const item = files[index];

            try {
                const formData = new FormData();

                formData.append("file", item.file);
                formData.append("lng", String(item.data.lng));
                formData.append("lat", String(item.data.lat));

                if (item.data.heading !== undefined) {
                    formData.append(
                        "heading",
                        String(item.data.heading)
                    );
                }

                if (item.data.pitch !== undefined) {
                    formData.append(
                        "pitch",
                        String(item.data.pitch)
                    );
                }

                if (item.data.filename) {
                    formData.append("filename", item.data.filename);
                }

                if (item.data.subdir) {
                    formData.append("subdir", item.data.subdir);
                }

                if (item.data.captured_at) {
                    formData.append(
                        "captured_at",
                        item.data.captured_at
                    );
                }

                const response =
                    await apiClient.request<StreetViewUploadResponse>(
                        "/api/streetview/upload",
                        {
                            method: "POST",
                            headers: getWriteHeaders(options.apiKey),
                            body: formData,
                            signal: options.signal,
                        }
                    );

                results[index] = {
                    index,
                    success: true,
                    data: response,
                };
            } catch (error) {
                results[index] = {
                    index,
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Upload thất bại",
                };
            }
        }
    }

    await Promise.all(
        Array.from(
            { length: concurrency },
            () => worker()
        )
    );

    // Đánh dấu những file chưa được xử lý do AbortSignal.
    for (let index = 0; index < files.length; index++) {
        if (!results[index]) {
            results[index] = {
                index,
                success: false,
                error: "Upload đã bị hủy",
            };
        }
    }

    return results;
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

export const fetchStreetViewPoints = getStreetViewPoints;
export const fetchStreetViewImages = getStreetViewImages;
export const fetchNearbyStreetView = getNearbyStreetView;
export const fetchStreetViewImage = getStreetViewImage;

export const updateStreetviewImage = updateStreetViewImage;
export const batchUpdateStreetviewImages = batchUpdateStreetViewImages;
export const deleteStreetviewImage = deleteStreetViewImage;
export const uploadStreetviewImage = uploadStreetViewImage;
