
import { apiClient } from "../../../core/api/ApiClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface PointInfoWard {
    id?: number | string;
    name?: string;
    code?: string;
    province?: string;
    district?: string;
    [key: string]: unknown;
}

export interface PointInfoRoad {
    id?: number | string;
    name?: string;
    highway?: string;
    distance_m?: number;
    [key: string]: unknown;
}

export interface PointInfoStreetview {
    id?: number | string;
    file_path?: string;
    image_url?: string;
    url?: string;
    heading?: number;
    pitch?: number;
    distance_m?: number;
    captured_at?: string;
    created_at?: string;
    [key: string]: unknown;
}

export interface PointInfoPoi {
    id: number | string;
    name?: string;
    category?: string;
    description?: string;
    address?: string;
    lng?: number;
    lat?: number;
    distance_m?: number;
    source?: "user" | "system";
    [key: string]: unknown;
}

export interface PointInfoNearbyPole {
    id: number | string;
    pole_code?: string;
    route?: string;
    status?: "good" | "warning" | "error";
    detail?: string;
    lng?: number;
    lat?: number;
    distance_m?: number;
    [key: string]: unknown;
}

export interface PointInfoResponse {
    ward?: PointInfoWard | null;
    road?: PointInfoRoad | null;
    streetview?: PointInfoStreetview | null;
    address?: string | null;
    pois?: PointInfoPoi[];
    nearby_poles?: PointInfoNearbyPole[];
}

export interface PointInfoParams {
    lng: number;
    lat: number;
    radius_m?: number;
    poi_limit?: number;
    pole_radius_m?: number;
    pole_limit?: number;
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/point-info
 *
 * Lấy thông tin tại một tọa độ:
 * - Xã/phường
 * - Đường gần nhất
 * - Streetview gần nhất
 * - POI xung quanh
 * - Trụ điện gần đó
 */
export async function getPointInfo(
    params: PointInfoParams
): Promise<PointInfoResponse> {
    const query = new URLSearchParams();

    query.set("lng", String(params.lng));
    query.set("lat", String(params.lat));

    if (params.radius_m !== undefined) {
        query.set("radius_m", String(params.radius_m));
    }

    if (params.poi_limit !== undefined) {
        query.set("poi_limit", String(params.poi_limit));
    }

    if (params.pole_radius_m !== undefined) {
        query.set("pole_radius_m", String(params.pole_radius_m));
    }

    if (params.pole_limit !== undefined) {
        query.set("pole_limit", String(params.pole_limit));
    }

    return apiClient.request<PointInfoResponse>(
        `/api/point-info?${query.toString()}`
    );
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

export const fetchPointInfo = getPointInfo;
