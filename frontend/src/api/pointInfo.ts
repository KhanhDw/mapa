
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// =========================
// Types
// =========================

export interface PointInfoWard {
  ma: string | null;
  tenhc: string | null;
  loai: string | null;
  full_name: string | null;
  matinh: string | null;
  tentinh: string | null;
  matinhxa: string | null;
  dansonguoi: number | null;
  trungtamhc: string | null;
  dientichkm2: number | null;
  truocsapnhap: string | null;
}

export interface PointInfoRoad {
  id: number;
  name: string | null;
  fclass: string | null;
  distance_m: number;
}

export interface PointInfoStreetview {
  id: number;
  file_path: string;
  heading: number;
  pitch: number;
  distance_m: number;
}

export interface PointInfoPoi {
  source: "osm" | "user";
  id: string;
  name: string | null;
  category: string | null;
  fclass: string | null;
  photo_count: number;
  lng: number;
  lat: number;
  distance_m: number;
  streetview_id: number | null;
  streetview_distance_m: number | null;
}

export type NearbyPoleStatus = "good" | "warning" | "error";

export interface PointInfoNearbyPole {
  id: number;
  pole_code: string;
  route: string;
  status: NearbyPoleStatus;
  detail: string | null;
  lng: number;
  lat: number;
  distance_m: number;
}

export interface PointInfoResponse {
  ward: PointInfoWard | null;
  road: PointInfoRoad | null;
  streetview: PointInfoStreetview | null;
  address: string | null;
  pois: PointInfoPoi[];
  nearby_poles: PointInfoNearbyPole[];
}

export interface PointInfoParams {
  lng: number;
  lat: number;
  radius_m?: number;
  poi_limit?: number;
  pole_radius_m?: number;
  pole_limit?: number;
}

// =========================
// API
// =========================

/**
 * GET /api/point-info
 *
 * Lấy thông tin tại một tọa độ:
 * - Đơn vị hành chính gần/bao chứa điểm
 * - Đường gần nhất
 * - Street View gần nhất
 * - POI xung quanh
 * - Trụ điện xung quanh
 */
export const getPointInfo = async (
  params: PointInfoParams
): Promise<PointInfoResponse> => {
  const response = await api.get<PointInfoResponse>(
    "/api/point-info",
    {
      params: {
        lng: params.lng,
        lat: params.lat,
        radius_m: params.radius_m,
        poi_limit: params.poi_limit,
        pole_radius_m: params.pole_radius_m,
        pole_limit: params.pole_limit,
      },
    }
  );

  return response.data;
};
