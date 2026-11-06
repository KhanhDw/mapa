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

        // Chuẩn hóa URL gọi API
        const cleanBase = apiBase.replace(/\/+$/, "");
        const url = `${cleanBase}/api/point-info?${params}`;

        async function fetchPointInfo() {
            try {
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        "Accept": "application/json",
                        // Header bypass ngrok trực tiếp
                        "ngrok-skip-browser-warning": "true",
                    },
                });

                // Nếu Backend trả về mã lỗi (4xx, 5xx)
                if (!response.ok) {
                    const rawErrorText = await response.text();
                    let parsedDetail = rawErrorText;

                    // Thử parse xem có phải JSON của FastAPI không ({"detail": "..."})
                    try {
                        const json = JSON.parse(rawErrorText);
                        parsedDetail =
                            typeof json.detail === "string"
                                ? json.detail
                                : JSON.stringify(json.detail || json, null, 2);
                    } catch {
                        // Nếu không parse được JSON -> Có thể là HTML lỗi 502/500 hoặc HTML của Ngrok
                    }

                    const fullMessage = `Lỗi [${response.status} ${response.statusText}] tại ${url}\nChi tiết: ${parsedDetail}`;

                    console.error("[useClickPointInfo] Chi tiết lỗi từ Server:", {
                        status: response.status,
                        statusText: response.statusText,
                        url,
                        responseBody: rawErrorText,
                    });

                    throw new Error(fullMessage);
                }

                // Parse dữ liệu thành công
                const data: PointInfoResponse = await response.json();
                setResult({ key, data, error: null });
            } catch (err: unknown) {
                if ((err as Error)?.name !== "AbortError") {
                    const errorObj =
                        err instanceof Error ? err : new Error(String(err));
                    console.error("[useClickPointInfo] Lỗi gọi API:", errorObj.message);
                    setResult({ key, data: null, error: errorObj });
                }
            }
        }

        fetchPointInfo();

        return () => controller.abort();
    }, [apiBase, clickInfo, key]);

    const matched = result.key === key;
    return {
        data: matched ? result.data : null,
        loading: clickInfo !== null && !matched,
        error: matched ? result.error : null,
    };
}