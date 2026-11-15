
import axios, {
    type AxiosResponse
} from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// =========================
// Types
// =========================

export type MVTTable =
  | "pois"
  | "roads"
  | "streetview"
  | "user_pois"
  | "electric_poles"
  | "wards"
  | "public.pois"
  | "public.vietnam_roads"
  | "public.streetview_images"
  | "user_data.pois"
  | "user_data.electric_poles"
  | "user_data.vietnam_wards_2025";

export interface TileRequestConfig {
  params?: Record<
    string,
    string | number | boolean | undefined
  >;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type TileResponse = AxiosResponse<ArrayBuffer>;

// =========================
// API
// =========================

/**
 * GET /tiles/{path}
 * HEAD /tiles/{path}
 *
 * Proxy request tới pg_tileserv.
 *
 * path là đường dẫn tile phía sau /tiles/.
 *
 * Ví dụ:
 * - public.pois/{z}/{x}/{y}.pbf
 * - public.vietnam_roads/{z}/{x}/{y}.pbf
 *
 * Dữ liệu trả về dạng binary.
 */
export const getTileservTile = async (
  path: string,
  config?: TileRequestConfig
): Promise<TileResponse> => {
  const response = await api.get<ArrayBuffer>(
    `/tiles/${path.replace(/^\/+/, "")}`,
    {
      params: config?.params,
      headers: config?.headers,
      signal: config?.signal,
      responseType: "arraybuffer",
    }
  );

  return response;
};

/**
 * HEAD /tiles/{path}
 *
 * Kiểm tra header của tile từ pg_tileserv
 * mà không tải nội dung tile.
 */
export const headTileservTile = async (
  path: string,
  config?: TileRequestConfig
): Promise<AxiosResponse<void>> => {
  const response = await api.head(
    `/tiles/${path.replace(/^\/+/, "")}`,
    {
      params: config?.params,
      headers: config?.headers,
      signal: config?.signal,
    }
  );

  return response;
};

/**
 * GET /basemap/{path}
 * HEAD /basemap/{path}
 *
 * Proxy request tới versatiles.
 *
 * Backend tự thêm prefix "tiles/" nếu path
 * chưa bắt đầu bằng "tiles/".
 *
 * Ví dụ:
 * - vietnam/{z}/{x}/{y}.pbf
 * - tiles/vietnam/{z}/{x}/{y}.pbf
 */
export const getBasemapTile = async (
  path: string,
  config?: TileRequestConfig
): Promise<TileResponse> => {
  const response = await api.get<ArrayBuffer>(
    `/basemap/${path.replace(/^\/+/, "")}`,
    {
      params: config?.params,
      headers: config?.headers,
      signal: config?.signal,
      responseType: "arraybuffer",
    }
  );

  return response;
};

/**
 * HEAD /basemap/{path}
 *
 * Kiểm tra header tile từ versatiles
 * mà không tải nội dung.
 */
export const headBasemapTile = async (
  path: string,
  config?: TileRequestConfig
): Promise<AxiosResponse<void>> => {
  const response = await api.head(
    `/basemap/${path.replace(/^\/+/, "")}`,
    {
      params: config?.params,
      headers: config?.headers,
      signal: config?.signal,
    }
  );

  return response;
};

/**
 * GET /mvt/{table}/{z}/{x}/{y}.pbf
 *
 * Tự sinh vector tile MVT từ database.
 *
 * Table hỗ trợ:
 * - pois
 * - roads
 * - streetview
 * - user_pois
 * - electric_poles
 * - wards
 *
 * Có thể truyền tên bảng đầy đủ theo schema DB.
 *
 * Zoom: 0–18.
 * x, y phải nằm trong phạm vi tile hợp lệ.
 */
export const getMvtTile = async (
  table: MVTTable,
  z: number,
  x: number,
  y: number,
  config?: Pick<TileRequestConfig, "signal">
): Promise<TileResponse> => {
  const response = await api.get<ArrayBuffer>(
    `/mvt/${table}/${z}/${x}/${y}.pbf`,
    {
      signal: config?.signal,
      responseType: "arraybuffer",
    }
  );

  return response;
};
