import type { Map as MapLibreMap } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

/**
 * Khi enabled = true → click map sẽ đặt marker xanh lá và gọi onPick.
 * Không can thiệp marker đỏ (dùng ở useClickMarker cho panel Info).
 */
export function useLocationPicker(
    map: MapLibreMap | null,
    enabled: boolean,
    onPick: (lng: number, lat: number) => void
): void {
    const markerRef = useRef<maplibregl.Marker | null>(null);

    useEffect(() => {
        if (!map || !enabled) return;

        const onClick = (e: maplibregl.MapMouseEvent) => {
            onPick(e.lngLat.lng, e.lngLat.lat);

            markerRef.current?.remove();
            markerRef.current = new maplibregl.Marker({ color: "#10b981" })
                .setLngLat(e.lngLat)
                .addTo(map);
        };

        map.on("click", onClick);
        map.getCanvas().style.cursor = "crosshair";

        return () => {
            map.off("click", onClick);
            map.getCanvas().style.cursor = "";
            try {
                markerRef.current?.remove();
            } catch {
                /* map removed */
            }
            markerRef.current = null;
        };
    }, [map, enabled, onPick]);
}