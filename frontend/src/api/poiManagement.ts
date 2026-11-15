
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const WRITE_API_KEY = import.meta.env.VITE_WRITE_API_KEY || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const writeHeaders = {
  "X-API-Key": WRITE_API_KEY,
};

// =========================
// Types
// =========================

export interface UserPoiManagement {
  id: number;
  source: "user";
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  lng: number;
  lat: number;
  created_at: string;
  photo_count: number;
  thumb_url: string | null;
}

export interface UserPoiListResponse {
  items: UserPoiManagement[];
  total: number;
}

export interface UpdateUserPoiRequest {
  name: string;
  category: string;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  lng: number;
  lat: number;
}

export interface UpdateUserPoiResponse {
  id: number;
  source: "user";
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  lng: number;
  lat: number;
  created_at: string;
}

export interface SystemPoi {
  id: string;
  source: "osm";
  name: string | null;
  category: string | null;
  fclass: string | null;
  has_name: boolean;
  lng: number;
  lat: number;
}

export interface SystemPoiListResponse {
  items: SystemPoi[];
  total: number;
}

// =========================
// User POIs
// =========================

/**
 * GET /api/user-pois
 * Không yêu cầu X-API-Key.
 */
export const getUserPois = async (params?: {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<UserPoiListResponse> => {
  const response = await api.get<UserPoiListResponse>(
    "/api/user-pois",
    { params }
  );

  return response.data;
};

/**
 * PUT /api/user-pois/{poi_id}
 * Requires X-API-Key.
 */
export const updateUserPoi = async (
  poiId: number,
  data: UpdateUserPoiRequest
): Promise<UpdateUserPoiResponse> => {
  const response = await api.put<UpdateUserPoiResponse>(
    `/api/user-pois/${poiId}`,
    data,
    {
      headers: writeHeaders,
    }
  );

  return response.data;
};

/**
 * DELETE /api/user-pois/{poi_id}
 * Requires X-API-Key.
 * Backend returns HTTP 204 with no response body.
 */
export const deleteUserPoi = async (
  poiId: number
): Promise<void> => {
  await api.delete(`/api/user-pois/${poiId}`, {
    headers: writeHeaders,
  });
};

/**
 * DELETE /api/user-pois/{poi_id}/photos/{photo_id}
 * Requires X-API-Key.
 * Backend returns HTTP 204 with no response body.
 */
export const deleteUserPoiPhoto = async (
  poiId: number,
  photoId: number
): Promise<void> => {
  await api.delete(
    `/api/user-pois/${poiId}/photos/${photoId}`,
    {
      headers: writeHeaders,
    }
  );
};

// =========================
// System POIs (read-only)
// =========================

/**
 * GET /api/system-pois
 * Không yêu cầu X-API-Key.
 */
export const getSystemPois = async (params?: {
  search?: string;
  fclass?: string;
  category?: string;
  has_name?: boolean;
  limit?: number;
  offset?: number;
}): Promise<SystemPoiListResponse> => {
  const response = await api.get<SystemPoiListResponse>(
    "/api/system-pois",
    { params }
  );

  return response.data;
};
