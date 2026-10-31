import { useEffect, useState } from "react";
import type {
    ClickInfo,
    PoiInfo,
    RoadInfo,
    StreetViewHit,
} from "../../../sidebar/CoordSidebar/CoordSidebar";

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
 * Fetch thông tin điểm (road / streetview / address / pois) khi người dùng click map.
 * Tự cancel request cũ nếu click liên tục.
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

        let cancelled = false;
        setLoading(true);
        setData(null);        // ✅ FIX: xoá data điểm cũ trước khi fetch điểm mới
        setError(null);

        const params = new URLSearchParams({
            lng: String(clickInfo.lng),
            lat: String(clickInfo.lat),
            zoom: String(clickInfo.zoom),
        });

        fetch(`${apiBase}/api/point-info?${params.toString()}`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json() as Promise<PointInfoResponse>;
            })
            .then((d) => {
                if (!cancelled) setData(d);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [apiBase, clickInfo?.lat, clickInfo?.lng, clickInfo?.zoom]);

    return { data, loading, error };
}