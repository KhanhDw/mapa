import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const WRITE_API_KEY = import.meta.env.VITE_WRITE_API_KEY || "";

const writeHeaders = {
  "X-API-Key": WRITE_API_KEY,
};

/** Giá trị mặc định cho form nhập API key trên UI (lấy từ VITE_WRITE_API_KEY). */
export const DEFAULT_API_KEY = WRITE_API_KEY;

// =========================
// Types
// =========================

export interface StreetViewPointProperties {
  id: number;
  file_path: string;
  image_url: string | null;
  heading: number;
  pitch: number;
}

export interface StreetViewPointFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: StreetViewPointProperties;
}

export interface StreetViewPointsResponse {
  type: "FeatureCollection";
  features: StreetViewPointFeature[];
  truncated: boolean;
}

export interface StreetViewPointsParams {
  minx?: number;
  miny?: number;
  maxx?: number;
  maxy?: number;
  limit?: number;
}

export interface StreetViewImage {
  id: number;
  lng: number;
  lat: number;
  file_path: string;
  image_url: string | null;
  heading: number;
  pitch: number;
  created_at: string | null;
  captured_at: string | null;
  distance_meters?: number;

  /**
   * [BACKEND CAVEAT] Schema public.streetview_images hiện KHÔNG có cột
   * next_ids / link_positions. Hai field optional để UI cũ không crash;
   * backend sẽ luôn trả undefined cho tới khi schema được mở rộng.
   */
  next_ids?: number[];
  link_positions?: Array<{ textureX: number; textureY: number }>;
}

export interface StreetViewImageListResponse {
  items: StreetViewImage[];
  total: number;
}

export interface StreetViewImagesParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface StreetViewNearbyParams {
  lng: number;
  lat: number;
  radius?: number;
  exclude_id?: number;
  limit?: number;
}

export interface StreetViewNearbyResponse {
  items: StreetViewImage[];
}

export interface StreetViewUpdate {
  heading?: number | null;
  pitch?: number | null;
  lng?: number | null;
  lat?: number | null;
  created_at?: string | null;
  captured_at?: string | null;
  /**
   * [BACKEND CAVEAT] Backend Pydantic (StreetViewUpdate) chưa khai báo
   * field này → request sẽ trả 422. Chỉ bật khi backend đã thêm cột
   * next_ids và handler UPDATE tương ứng.
   */
  next_ids?: number[] | null;
}

export interface BatchUpdateInput {
  ids: number[];
  delta_lng?: number | null;
  delta_lat?: number | null;
  created_at?: string | null;
  captured_at?: string | null;
}

export interface BatchUpdateResponse {
  updated_count: number;
}

// =========================
// API — đọc
// =========================

/**
 * GET /api/streetview/points
 *
 * Lấy danh sách vị trí Street View dạng GeoJSON FeatureCollection.
 * Truyền đủ 4 tham số bbox (minx, miny, maxx, maxy) hoặc không truyền gì.
 */
export const getStreetViewPoints = async (
  params?: StreetViewPointsParams
): Promise<StreetViewPointsResponse> => {
  const response = await api.get<StreetViewPointsResponse>(
    "/api/streetview/points",
    {
      params: {
        minx: params?.minx,
        miny: params?.miny,
        maxx: params?.maxx,
        maxy: params?.maxy,
        limit: params?.limit,
      },
    }
  );
  return response.data;
};

/**
 * GET /api/streetview/images
 *
 * Lấy danh sách ảnh phục vụ quản lý.
 * - search: tìm theo file_path hoặc id
 * - limit: mặc định 50, tối đa 200
 * - offset: mặc định 0
 */
export const getStreetViewImages = async (
  params?: StreetViewImagesParams
): Promise<StreetViewImageListResponse> => {
  const response = await api.get<StreetViewImageListResponse>(
    "/api/streetview/images",
    {
      params: {
        search: params?.search,
        limit: params?.limit,
        offset: params?.offset,
      },
    }
  );
  return response.data;
};

/**
 * GET /api/streetview/nearby
 *
 * Lấy ảnh panorama xung quanh toạ độ (bán kính mét).
 */
export const getNearbyStreetViewImages = async (
  params: StreetViewNearbyParams
): Promise<StreetViewNearbyResponse> => {
  const response = await api.get<StreetViewNearbyResponse>(
    "/api/streetview/nearby",
    {
      params: {
        lng: params.lng,
        lat: params.lat,
        radius: params.radius,
        exclude_id: params.exclude_id,
        limit: params.limit,
      },
    }
  );
  return response.data;
};

/**
 * GET /api/streetview/image/{image_id}
 */
export const getStreetViewImage = async (
  imageId: number
): Promise<StreetViewImage> => {
  const response = await api.get<StreetViewImage>(
    `/api/streetview/image/${imageId}`
  );
  return response.data;
};

// =========================
// API — ghi
// =========================

/**
 * PUT /api/streetview/image/{image_id}
 *
 * Yêu cầu X-API-Key. `apiKey` (nếu truyền) override VITE_WRITE_API_KEY.
 */
export const updateStreetViewImage = async (
  imageId: number,
  data: StreetViewUpdate,
  apiKey?: string
): Promise<StreetViewImage> => {
  const response = await api.put<StreetViewImage>(
    `/api/streetview/image/${imageId}`,
    data,
    {
      headers: apiKey ? { "X-API-Key": apiKey } : writeHeaders,
    }
  );
  return response.data;
};

/**
 * PATCH /api/streetview/batch-update
 *
 * Yêu cầu X-API-Key.
 */
export const batchUpdateStreetView = async (
  data: BatchUpdateInput,
  apiKey?: string
): Promise<BatchUpdateResponse> => {
  const response = await api.patch<BatchUpdateResponse>(
    "/api/streetview/batch-update",
    data,
    {
      headers: apiKey ? { "X-API-Key": apiKey } : writeHeaders,
    }
  );
  return response.data;
};

/**
 * DELETE /api/streetview/image/{image_id}
 *
 * Yêu cầu X-API-Key. Backend trả 204 No Content.
 */
export const deleteStreetViewImage = async (
  imageId: number,
  apiKey?: string
): Promise<void> => {
  await api.delete(`/api/streetview/image/${imageId}`, {
    headers: apiKey ? { "X-API-Key": apiKey } : writeHeaders,
  });
};

// =========================
// API — upload
// =========================

export interface StreetViewUploadResponse extends StreetViewImage {
  size_bytes: number;
}

export interface StreetViewUploadParams {
  /** File từ <input type="file"> hoặc Blob bất kỳ. */
  file: File | Blob;
  lng: number;
  lat: number;
  /** 0 ≤ heading < 360 (mặc định 0). */
  heading?: number;
  /** -90 ≤ pitch ≤ 90 (mặc định 0). */
  pitch?: number;
  /** Chỉ stem (không cần extension); backend sẽ lấy ext từ file gốc. */
  filename?: string;
  /** Thư mục con dưới PANORAMAS_DIR, vd. "2025/01" (mặc định rỗng). */
  subdir?: string;
  /** ISO 8601. Mặc định = now() trên server. */
  captured_at?: string;
}

export interface StreetViewUploadOptions {
  /** Override X-API-Key cho riêng request này (fallback: VITE_WRITE_API_KEY). */
  apiKey?: string;
  /** Callback tiến trình upload. */
  onUploadProgress?: (p: { loaded: number; total?: number; percent: number }) => void;
  /** AbortSignal để huỷ upload. */
  signal?: AbortSignal;
}

export interface StreetViewBatchUploadResult {
  successful: StreetViewUploadResponse[];
  failed: Array<{ item: StreetViewUploadParams; error: unknown }>;
}

/**
 * Tên file gửi kèm part `file`. Backend chỉ đọc extension từ đây
 * để validate định dạng — nếu `file` là Blob (không có .name),
 * ta tự đoán ext từ `filename` hoặc mặc định .jpg.
 */
const _resolveUploadName = (file: File | Blob, filename?: string): string => {
  const fname = (file as File).name;
  if (fname && /\.[A-Za-z0-9]+$/.test(fname)) return fname;
  if (filename) return filename.includes(".") ? filename : `${filename}.jpg`;
  return "panorama.jpg";
};

/**
 * POST /api/streetview/upload
 *
 * Upload 1 ảnh panorama (multipart/form-data).
 * Backend validate extension + size (≤ 50 MB), ghi atomic vào
 * PANORAMAS_DIR và trả về object chi tiết kèm `size_bytes`.
 *
 * Yêu cầu X-API-Key.
 */
export const uploadStreetViewImage = async (
  params: StreetViewUploadParams,
  options?: StreetViewUploadOptions
): Promise<StreetViewUploadResponse> => {
  const fd = new FormData();

  fd.append("file", params.file, _resolveUploadName(params.file, params.filename));
  fd.append("lng", String(params.lng));
  fd.append("lat", String(params.lat));
  fd.append("heading", String(params.heading ?? 0));
  fd.append("pitch", String(params.pitch ?? 0));

  if (params.filename) fd.append("filename", params.filename);
  if (params.subdir) fd.append("subdir", params.subdir);
  if (params.captured_at) fd.append("captured_at", params.captured_at);

  const response = await api.post<StreetViewUploadResponse>(
    "/api/streetview/upload",
    fd,
    {
      headers: {
        ...writeHeaders,
        ...(options?.apiKey ? { "X-API-Key": options.apiKey } : {}),
        // KHÔNG set Content-Type — axios/FormData tự sinh boundary
      },
      signal: options?.signal,
      onUploadProgress: options?.onUploadProgress
        ? (e) => {
            const total = e.total ?? 0;
            options.onUploadProgress!({
              loaded: e.loaded,
              total: e.total,
              percent: total > 0 ? Math.round((e.loaded * 100) / total) : 0,
            });
          }
        : undefined,
    }
  );

  return response.data;
};

/**
 * Upload nhiều ảnh song song (mặc định 3 luồng).
 * Lỗi của item này không ảnh hưởng item khác.
 */
export const uploadStreetViewImages = async (
  items: StreetViewUploadParams[],
  options?: {
    apiKey?: string;
    concurrency?: number;
    signal?: AbortSignal;
    onProgress?: (
      done: number,
      total: number,
      last: StreetViewUploadResponse | null
    ) => void;
  }
): Promise<StreetViewBatchUploadResult> => {
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const result: StreetViewBatchUploadResult = { successful: [], failed: [] };
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const res = await uploadStreetViewImage(items[idx], {
          apiKey: options?.apiKey,
          signal: options?.signal,
        });
        result.successful.push(res);
        done += 1;
        options?.onProgress?.(done, items.length, res);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "CanceledError" || name === "AbortError") {
          throw err;
        }
        result.failed.push({ item: items[idx], error: err });
        done += 1;
        options?.onProgress?.(done, items.length, null);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return result;
};