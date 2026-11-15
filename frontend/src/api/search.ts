
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// =========================
// Types
// =========================

export type SearchSource = "admin" | "osm" | "user";

export interface PlaceSearchResult {
  id: string;
  name: string;
  kind: "admin" | "place";
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  source: SearchSource;
}

export type RoadGeometry =
  | {
      type: "LineString";
      coordinates: number[][];
    }
  | {
      type: "MultiLineString";
      coordinates: number[][][];
    };

export type RoadBbox = [
  west: number,
  south: number,
  east: number,
  north: number
];

export interface RoadSearchResult {
  id: string;
  name: string;
  kind: "road";
  category: string | null;
  address: null;
  lat: number;
  lng: number;
  source: "osm";
  geometry: RoadGeometry;
  bbox: RoadBbox;
}

export type SearchResult =
  | PlaceSearchResult
  | RoadSearchResult;

export interface SearchResponse {
  results: SearchResult[];
}

export interface SearchParams {
  q: string;
}

// =========================
// API
// =========================

/**
 * GET /api/search
 *
 * Tìm kiếm hợp nhất:
 * - Đơn vị hành chính (xã/phường/đặc khu)
 * - POI hệ thống (OSM)
 * - POI do người dùng đóng góp
 * - Đường giao thông
 *
 * Query:
 * - q: 2–100 ký tự
 *
 * Response:
 * - results: danh sách kết quả tìm kiếm
 *
 * Giới hạn backend:
 * - Tối đa 12 kết quả địa điểm
 * - Tối đa 8 kết quả đường
 */
export const searchMap = async (
  q: string
): Promise<SearchResponse> => {
  const response = await api.get<SearchResponse>(
    "/api/search",
    {
      params: {
        q,
      },
    }
  );

  return response.data;
};
