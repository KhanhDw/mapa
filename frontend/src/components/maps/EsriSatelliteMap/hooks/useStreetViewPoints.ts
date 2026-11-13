import { useEffect, useState } from "react";
import type { StreetViewPoint } from "../../../streetview/StreetViewModal/StreetViewModal";
import { SV_LIMIT } from "../constants";

export interface StreetViewFeatureProps {
    id: number;
    image_url: string;
    heading: number | null;
    next_ids: number[];
    link_positions: Array<{ textureX: number; textureY: number }>;
}

export interface StreetViewGeoJSON {
    type: "FeatureCollection";
    features: Array<{
        type: "Feature";
        geometry: { type: "Point"; coordinates: [number, number] };
        properties: StreetViewFeatureProps;
    }>;
}

interface Result {
    points: StreetViewPoint[];
    geojson: StreetViewGeoJSON | null;
    error: Error | null;
}

/**
 * @param version bump số này để buộc refetch (VD: sau khi thêm/sửa/xoá street view).
 */
export function useStreetViewPoints(
    apiBase: string,
    version: number = 0,
): Result {
    const [points, setPoints] = useState<StreetViewPoint[]>([]);
    const [geojson, setGeojson] = useState<StreetViewGeoJSON | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const base = apiBase.replace(/\/+$/, "");

        (async () => {
            try {
                const url = `${base}/api/streetview/points?limit=${SV_LIMIT}`;
                const res = await fetch(url, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                if (!res.ok) {
                    throw new Error(
                        `Không tải được Street View points: HTTP ${res.status} — ${res.url}`,
                    );
                }

                const data = (await res.json()) as StreetViewGeoJSON;
                if (!Array.isArray(data?.features)) {
                    throw new Error(
                        "Phản hồi /api/streetview/points không phải GeoJSON FeatureCollection hợp lệ",
                    );
                }

                const parsed: StreetViewPoint[] = data.features
                    .filter(
                        (f) =>
                            f?.geometry?.type === "Point" &&
                            Array.isArray(f.geometry.coordinates) &&
                            f.geometry.coordinates.length >= 2,
                    )
                    .map((f) => ({
                        ...f.properties,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1],
                    }));

                setGeojson(data);
                setPoints(parsed);
                setError(null);
            } catch (e) {
                if (controller.signal.aborted) return;
                const err =
                    e instanceof Error
                        ? e
                        : new Error("Không xác định được lỗi tải Street View points");
                console.error("[SV points] fetch error:", err);
                setError(err);
            }
        })();

        return () => controller.abort();
    }, [apiBase, version]);

    return { points, geojson, error };
}