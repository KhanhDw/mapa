import { useEffect, useState } from "react";
import type {
    ClickInfo,
    PoiInfo,
    RoadInfo,
    StreetViewHit,
} from "../../../sidebar/CoordSidebar/CoordSidebar";
import { POINT_INFO_POI_LIMIT, POINT_INFO_RADIUS_M } from "../constants";

export interface PointInfoResponse {
    road: RoadInfo | null;
    streetview: StreetViewHit | null;
    address: string | null;
    pois: PoiInfo[];
}

interface Result {
    data: PointInfoResponse | null;
    loading: boolean;
    error: Error | null;
}

/**
 * Fetch /api/point-info khi click map (spec §4.3).
 * Params: lng, lat, radius_m, poi_limit — KHÔNG gửi zoom.
 */
export function useClickPointInfo(
    apiBase: string,
    clickInfo: ClickInfo | null
): Result {
    const [data, setData] = useState<PointInfoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!clickInfo) {
            setData(null);
            setError(null);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setData(null);
        setError(null);

        const params = new URLSearchParams({
            lng: String(clickInfo.lng),
            lat: String(clickInfo.lat),
            radius_m: String(POINT_INFO_RADIUS_M),
            poi_limit: String(POINT_INFO_POI_LIMIT),
        });

        fetch(`${apiBase.replace(/\/+$/, "")}/api/point-info?${params}`, {
            signal: controller.signal,
        })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json() as Promise<PointInfoResponse>;
            })
            .then((d) => setData(d))
            .catch((err: Error) => {
                if (err.name !== "AbortError") setError(err);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [apiBase, clickInfo?.lat, clickInfo?.lng]);

    return { data, loading, error };
}