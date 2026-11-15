
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const WRITE_API_KEY = import.meta.env.VITE_WRITE_API_KEY || "";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const writeHeaders = {
  "X-API-Key": WRITE_API_KEY,
};

export type ElectricPoleStatus = "good" | "warning" | "error";

export interface ElectricPole {
  id: number;
  pole_code: string;
  route: string;
  status: ElectricPoleStatus;
  detail: string | null;
  lng: number;
  lat: number;
  created_at: string;
  updated_at: string;
}

export interface ElectricPoleInput {
  pole_code: string;
  route: string;
  status?: ElectricPoleStatus;
  lng: number;
  lat: number;
  detail?: string | null;
}

export interface ElectricPoleListResponse {
  items: ElectricPole[];
  total: number;
}

/**
 * GET /api/electric-poles
 * search: tìm theo pole_code hoặc route.
 */
export const getElectricPoles = async (
  search?: string
): Promise<ElectricPoleListResponse> => {
  const response = await api.get<ElectricPoleListResponse>(
    "/api/electric-poles",
    {
      params: search?.trim() ? { search: search.trim() } : undefined,
    }
  );

  return response.data;
};

/**
 * GET /api/electric-poles/{pole_id}
 */
export const getElectricPole = async (
  poleId: number
): Promise<ElectricPole> => {
  const response = await api.get<ElectricPole>(
    `/api/electric-poles/${poleId}`
  );

  return response.data;
};

/**
 * POST /api/electric-poles
 * Requires X-API-Key.
 * Backend returns HTTP 201.
 */
export const createElectricPole = async (
  data: ElectricPoleInput
): Promise<ElectricPole> => {
  const response = await api.post<ElectricPole>(
    "/api/electric-poles",
    data,
    {
      headers: writeHeaders,
    }
  );

  return response.data;
};

/**
 * PUT /api/electric-poles/{pole_id}
 * Requires X-API-Key.
 */
export const updateElectricPole = async (
  poleId: number,
  data: ElectricPoleInput
): Promise<ElectricPole> => {
  const response = await api.put<ElectricPole>(
    `/api/electric-poles/${poleId}`,
    data,
    {
      headers: writeHeaders,
    }
  );

  return response.data;
};

/**
 * DELETE /api/electric-poles/{pole_id}
 * Requires X-API-Key.
 * Backend returns HTTP 204 with no response body.
 */
export const deleteElectricPole = async (
  poleId: number
): Promise<void> => {
  await api.delete(`/api/electric-poles/${poleId}`, {
    headers: writeHeaders,
  });
};
