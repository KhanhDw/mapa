import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./SatelliteMap.css";

const SATELLITE_URL =
    import.meta.env.VITE_SATELLITE_URL ??
    "http://localhost:8080/tiles/satellite/{z}/{x}/{y}";

function App() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        setWorkerUrl(
            `https://cdn.jsdelivr.net/npm/maplibre-gl@${getVersion()}/dist/maplibre-gl-worker.mjs`,
        );

        const map = new maplibregl.Map({
            container: mapContainer.current,
            center: [105.85, 21.03],
            zoom: 6,
            minZoom: 2,
            maxZoom: 12,
            maxBounds: [
                [98, 3],
                [122, 27],
            ],
            style: {
                version: 8,
                sources: {
                    satellite: {
                        type: "raster",
                        tiles: [SATELLITE_URL],
                        tileSize: 512,
                        minzoom: 0,
                        maxzoom: 12,
                        bounds: [102, 6, 118, 24],
                        attribution: "Ảnh vệ tinh: VersaTiles",
                    },
                },
                layers: [
                    {
                        id: "satellite-layer",
                        type: "raster",
                        source: "satellite",
                        layout: {
                            visibility: "visible",
                        },
                    },
                ],
            },
        });

        map.addControl(
            new maplibregl.NavigationControl(),
            "top-right",
        );

        map.addControl(
            new maplibregl.ScaleControl({
                maxWidth: 120,
                unit: "metric",
            }),
            "bottom-left",
        );

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return (
        <main className="satellite-map">
            <div
                ref={mapContainer}
                className="satellite-map__canvas"
                aria-label="Bản đồ vệ tinh Việt Nam"
            />
        </main>
    );
}

export default App;