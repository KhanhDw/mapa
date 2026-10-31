import { useEffect, useState } from "react";
import type { StreetViewPoint } from "../../../streetview/StreetViewModal/StreetViewModal";
import { SV_LIMIT } from "../constants";

interface Result {
    points: StreetViewPoint[];
    /** GeoJSON gốc từ API — dùng để addSource vào map */
    geojson: any | null;
    error: Error | null;
}

/**
 * Fetch street view points 1 lần khi mount (spec §4.2).
 * Thiếu bbox → backend trả `limit` điểm đầu tiên theo `id`.
 */
export function useStreetViewPoints(apiBase: string): Result {
    const [points, setPoints] = useState<StreetViewPoint[]>([]);
    const [geojson, setGeojson] = useState<any | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const base = apiBase.replace(/\/+$/, "");
        setError(null);

        (async () => {
            try {
                const res = await fetch(
                    `${base}/api/streetview/points?limit=${SV_LIMIT}`,
                    { signal: controller.signal }
                );
                if (!res.ok) {
                    throw new Error(
                        `Không tải được Street View points: HTTP ${res.status} — ${res.url}`
                    );
                }

                const data = await res.json();
                if (!Array.isArray(data?.features)) {
                    throw new Error(
                        "Phản hồi /api/streetview/points không phải GeoJSON FeatureCollection hợp lệ"
                    );
                }

                const parsed: StreetViewPoint[] = data.features
                    .filter(
                        (f: any) =>
                            f?.geometry?.type === "Point" &&
                            Array.isArray(f.geometry.coordinates) &&
                            f.geometry.coordinates.length >= 2
                    )
                    .map((f: any) => ({
                        ...f.properties,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1],
                    }));

                setGeojson(data);
                setPoints(parsed);
            } catch (e) {
                if (controller.signal.aborted) return;
                setError(
                    e instanceof Error
                        ? e
                        : new Error("Không xác định được lỗi tải Street View points")
                );
            }
        })();

        return () => controller.abort();
    }, [apiBase]);

    return { points, geojson, error };
}