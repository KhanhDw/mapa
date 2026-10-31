import type { Map as MapLibreMap } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClickInfo } from "../../../sidebar/CoordSidebar/CoordSidebar";
import { SV_LAYER_ID } from "../constants";

interface Result {
    clickInfo: ClickInfo | null;
    clear: () => void;
}

export function useClickMarker(map: MapLibreMap | null): Result {
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
    const markerRef = useRef<maplibregl.Marker | null>(null);

    useEffect(() => {
        if (!map) return;

        const onClick = (e: maplibregl.MapMouseEvent) => {
            // Click trúng X street view → modal tự xử lý, không đặt marker
            if (map.getLayer(SV_LAYER_ID)) {
                const hit = map.queryRenderedFeatures(e.point, {
                    layers: [SV_LAYER_ID],
                });
                if (hit.length > 0) return;
            }

            setClickInfo({
                lng: e.lngLat.lng,
                lat: e.lngLat.lat,
                zoom: map.getZoom(),
            });

            markerRef.current?.remove();
            markerRef.current = new maplibregl.Marker({ color: "#e8453c" })
                .setLngLat(e.lngLat)
                .addTo(map);
        };

        map.on("click", onClick);

        return () => {
            map.off("click", onClick);
            try {
                markerRef.current?.remove();
            } catch {
                /* map đã bị remove */
            }
            markerRef.current = null;
        };
    }, [map]);

    const clear = useCallback(() => {
        markerRef.current?.remove();
        markerRef.current = null;
        setClickInfo(null);
    }, []);

    return { clickInfo, clear };
}