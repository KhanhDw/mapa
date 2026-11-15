
import axios from "axios";

/**
 * Public Contribute API
 * Backend: backend/src/routers/contribute_public.py
 * Base prefix: /api/contribute
 * Không yêu cầu X-API-Key
 */

// ==================== TYPES ====================

export interface CreatePoiRequest {
  name: string;
  category: string;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  lng: number;
  lat: number;
}

export interface CreatePoiResponse extends CreatePoiRequest {
  id: number;
  source: "user";
  created_at: string;
  photos: PoiPhoto[];
}

export interface PoiPhoto {
  id: number;
  url: string;
  thumb_url: string;
  width: number;
  height: number;
  created_at: string;
}

export interface UploadPanoramaRequest {
  lng: number;
  lat: number;
  heading?: number;
  pitch?: number;
  file: File;
}

export interface UploadPanoramaResponse {
  id: number;
  file_path: string;
  image_url: string;
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

// ==================== API FUNCTIONS ====================

/**
 * POST /api/contribute/poi
 * Tạo địa điểm mới
 */
export const createPoi = async (
  body: CreatePoiRequest
): Promise<CreatePoiResponse> => {
  const response = await contributeApi.post<CreatePoiResponse>(
    "/api/contribute/poi",
    body
  );

  return response.data;
};

/**
 * POST /api/contribute/photos/{poi_id}
 * Upload ảnh cho địa điểm
 *
 * Backend nhận multipart/form-data với field: file
 */
export const uploadPoiPhoto = async (
  poiId: number,
  file: File
): Promise<PoiPhoto> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await contributeApi.post<PoiPhoto>(
    `/api/contribute/photos/${poiId}`,
    formData
  );

  return response.data;
};

/**
 * POST /api/contribute/panorama
 * Upload ảnh panorama / Street View
 *
 * Backend nhận multipart/form-data:
 * lng, lat, heading, pitch, file
 */
export const uploadPanorama = async (
  data: UploadPanoramaRequest
): Promise<UploadPanoramaResponse> => {
  const formData = new FormData();

  formData.append("lng", String(data.lng));
  formData.append("lat", String(data.lat));
  formData.append("heading", String(data.heading ?? 0));
  formData.append("pitch", String(data.pitch ?? 0));
  formData.append("file", data.file);

  const response = await contributeApi.post<UploadPanoramaResponse>(
    "/api/contribute/panorama",
    formData
  );

  return response.data;
};

// ==================== EXPORT ====================

export default {
  createPoi,
  uploadPoiPhoto,
  uploadPanorama,
};
