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

export function useClickPointInfo(
    apiBase: string,
    clickInfo: ClickInfo | null
): Result {
    const [result, setResult] = useState<{
        key: string;
        data: PointInfoResponse | null;
        error: Error | null;
    }>({ key: "", data: null, error: null });

    const key = clickInfo ? `${clickInfo.lng}|${clickInfo.lat}` : "";

    useEffect(() => {
        if (!clickInfo) return;

        const controller = new AbortController();
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
            .then((d) => setResult({ key, data: d, error: null }))
            .catch((err: Error) => {
                if (err.name !== "AbortError") {
                    setResult({ key, data: null, error: err });
                }
            });

        return () => controller.abort();
    }, [apiBase, clickInfo, key]);

    const matched = result.key === key;
    return {
        data: matched ? result.data : null,
        loading: clickInfo !== null && !matched,
        error: matched ? result.error : null,
    };
}