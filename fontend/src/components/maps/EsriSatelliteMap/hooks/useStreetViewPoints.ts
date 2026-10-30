import { useEffect, useState } from "react";
import type { StreetViewPoint } from "../../../streetview/StreetViewModal/StreetViewModal";

interface Result {
    points: StreetViewPoint[];
    /** GeoJSON gốc từ API — dùng để addSource vào map */
    geojson: any | null;
    error: Error | null;
}

/**
 * Fetch danh sách street view points từ backend.
 * Chạy độc lập với map — bắt đầu ngay khi mount.
 */
export function useStreetViewPoints(apiBase: string): Result {
    const [points, setPoints] = useState<StreetViewPoint[]>([]);
    const [geojson, setGeojson] = useState<any | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetch(`${apiBase}/api/streetview/points`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data) => {
                if (cancelled) return;

                const parsed: StreetViewPoint[] = data.features.map(
                    (f: any) => ({
                        ...f.properties,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1],
                    })
                );

                setGeojson(data);
                setPoints(parsed);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [apiBase]);

    return { points, geojson, error };
}