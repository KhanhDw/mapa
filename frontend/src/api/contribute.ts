
import axios from "axios";

/**
 * Backend: backend/src/routers/contribute.py
 * Router prefix: /api
 *
 * POST /user-pois
 * GET  /user-pois/{poi_id}
 * POST /user-pois/{poi_id}/photos
 * POST /user-panoramas
 */

// ==================== TYPES ====================

export interface UserPoiRequest {
  lng: number;
  lat: number;
  name: string;
  category?: string;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
}

export interface UserPoiResponse {
  id: number;
  source: "user";
  lng: number;
  lat: number;
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  created_at: string;
  photos: UserPoiPhoto[];
}

export interface UserPoiPhoto {
  id: number;
  url: string | null;
  thumb_url: string | null;
  created_at: string;
}

export interface UploadPoiPhotoResponse {
  id: number;
  url: string | null;
  thumb_url: string | null;
  width: number;
  height: number;
  created_at: string;
}

export interface UploadUserPanoramaRequest {
  lng: number;
  lat: number;
  heading?: number;
  pitch?: number;
  file: File;
}

export interface UploadUserPanoramaResponse {
  id: number;
  file_path: string;
  image_url: string | null;
  lng: number;
  lat: number;
  heading: number;
  pitch: number;
  width: number;
  height: number;
  created_at: string;
}

// ==================== AXIOS INSTANCE ====================

const contributeApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: {
    Accept: "application/json",
  },
});

// Gắn API Key cho các endpoint yêu cầu xác thực
const getWriteHeaders = () => ({
  "X-API-Key": import.meta.env.VITE_WRITE_API_KEY || "",
});

// ==================== API FUNCTIONS ====================

/**
 * POST /api/user-pois
 * Tạo địa điểm người dùng
 * Yêu cầu X-API-Key
 */
export const createUserPoi = async (
  body: UserPoiRequest
): Promise<UserPoiResponse> => {
  const response = await contributeApi.post<UserPoiResponse>(
    "/api/user-pois",
    body,
    {
      headers: getWriteHeaders(),
    }
  );

  return response.data;
};

/**
 * GET /api/user-pois/{poi_id}
 * Lấy thông tin chi tiết địa điểm và danh sách ảnh
 * Không yêu cầu X-API-Key
 */
export const getUserPoi = async (
  poiId: number
): Promise<UserPoiResponse> => {
  const response = await contributeApi.get<UserPoiResponse>(
    `/api/user-pois/${poiId}`
  );

  return response.data;
};

/**
 * POST /api/user-pois/{poi_id}/photos
 * Upload ảnh cho địa điểm
 * Yêu cầu X-API-Key
 *
 * Multipart field: file
 */
export const uploadUserPoiPhoto = async (
  poiId: number,
  file: File
): Promise<UploadPoiPhotoResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await contributeApi.post<UploadPoiPhotoResponse>(
    `/api/user-pois/${poiId}/photos`,
    formData,
    {
      headers: {
        ...getWriteHeaders(),
      },
    }
  );

  return response.data;
};

/**
 * POST /api/user-panoramas
 * Upload ảnh panorama 360°
 * Yêu cầu X-API-Key
 *
 * Multipart fields:
 * lng, lat, heading, pitch, file
 */
export const uploadUserPanorama = async (
  data: UploadUserPanoramaRequest
): Promise<UploadUserPanoramaResponse> => {
  const formData = new FormData();

  formData.append("lng", String(data.lng));
  formData.append("lat", String(data.lat));
  formData.append("heading", String(data.heading ?? 0));
  formData.append("pitch", String(data.pitch ?? 0));
  formData.append("file", data.file);

  const response = await contributeApi.post<UploadUserPanoramaResponse>(
    "/api/user-panoramas",
    formData,
    {
      headers: {
        ...getWriteHeaders(),
      },
    }
  );

  return response.data;
};

// ==================== EXPORT ====================

export default {
  createUserPoi,
  getUserPoi,
  uploadUserPoiPhoto,
  uploadUserPanorama,
};
