import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./EsriSatelliteMap.css";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { StreetViewModal, type StreetViewPoint } from "./StreetViewModal";
import { CoordSidebar, type ClickInfo } from "./CoordSidebar";
import {
    API_BASE,
    ESRI_SATELLITE_TILE_URL,
    getMapLibreWorkerUrl,
    TILE_BASE,
} from "../config";

function EsriSatelliteMap() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    const [svPoints, setSvPoints] = useState<StreetViewPoint[]>([]);
    const [svModal, setSvModal] = useState<{ open: boolean; startId: number } | null>(null);

    const markerRef = useRef<maplibregl.Marker | null>(null);
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        setWorkerUrl(
            getMapLibreWorkerUrl(getVersion())
        );

        const map = new maplibregl.Map({
            container: mapContainer.current,
            center: [105.43, 10.38],
            zoom: 13,
            minZoom: 3,
            maxZoom: 18,
            style: {
                version: 8,
                sources: {
                    "satellite-esri": {
                        type: "raster",
                        tiles: [
                            ESRI_SATELLITE_TILE_URL,
                        ],
                        tileSize: 256,
                        maxzoom: 19,
                        attribution: "Tiles © Esri",
                    },
                },
                layers: [
                    {
                        id: "satellite-layer",
                        type: "raster",
                        source: "satellite-esri",
                        minzoom: 0,
                        maxzoom: 22,
                    },
                ],
            },
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.addControl(
            new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
            "bottom-left"
        );
        map.on("error", (e) => console.error("[maplibre]", e.error));
        mapRef.current = map;

        const onLoad = () => {
            // Đường từ PostGIS
            map.addSource("roads-pg", {
                type: "vector",
                tiles: [`${TILE_BASE}/public.vietnam_roads/{z}/{x}/{y}.pbf`],
                minzoom: 0,
                maxzoom: 14,
            });

            map.addLayer({
                id: "roads-pg-layer",
                type: "line",
                source: "roads-pg",
                "source-layer": "public.vietnam_roads",
                minzoom: 14,                          // ← THÊM DÒNG NÀY
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": [
                        "match", ["get", "fclass"],
                        "motorway", "#ff5500",
                        "trunk", "#ff8800",
                        "primary", "#ffcc00",
                        "secondary", "#ffe066",
                        "tertiary", "#fff2b3",
                        "residential", "#ffffff",
                        "service", "#cccccc",
                        "unclassified", "#e5e5e5",
                        "#ffffff",
                    ],
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        14, 5, 18, 9,
                    ],
                    "line-opacity": [
                        "interpolate", ["linear"], ["zoom"],
                        3, 0.95,
                        6, 0.75,
                        10, 0.45,
                        14, 0.35,
                        18, 0.2,
                    ],
                },
            });

            // ✅ Fetch street view points — KHÔNG có points.length ở đây
            fetch(`${API_BASE}/api/streetview/points`)
                .then((r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
                .then((geojson) => {
                    const points: StreetViewPoint[] = geojson.features.map(
                        (f: any) => ({
                            ...f.properties,
                            lng: f.geometry.coordinates[0],
                            lat: f.geometry.coordinates[1],
                        })
                    );
                    console.log("[SV] fetched points:", points.length, points);

                    // ✅ setState + addSource + addLayer
                    setSvPoints(points);
                    map.addSource("sv-points", { type: "geojson", data: geojson });
                    map.addLayer({
                        id: "sv-points-layer",
                        type: "circle",
                        source: "sv-points",
                        paint: {
                            "circle-radius": 9,
                            "circle-color": "#1a73e8",
                            "circle-stroke-width": 2.5,
                            "circle-stroke-color": "#ffffff",
                        },
                    });



                    // Đảm bảo marker nằm trên cùng (không bị roads đè)
                    map.moveLayer("sv-points-layer");

                    // Click handler
                    map.on("click", "sv-points-layer", (e) => {
                        const id = e.features?.[0]?.properties?.id;
                        console.log("[SV] clicked, id =", id, typeof id);
                        if (id != null) {
                            setSvModal({ open: true, startId: Number(id) });
                        }
                    });

                    map.on("mouseenter", "sv-points-layer", () => {
                        map.getCanvas().style.cursor = "pointer";
                    });
                    map.on("mouseleave", "sv-points-layer", () => {
                        map.getCanvas().style.cursor = "";
                    });
                    map.on("click", (e) => {
                        // Bỏ qua nếu click trúng điểm Street View (đã có modal xử lý)
                        if (map.getLayer("sv-points-layer")) {
                            const hit = map.queryRenderedFeatures(e.point, {
                                layers: ["sv-points-layer"],
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
                    });
                })
                .catch((err) => console.error("[sv-points] fetch error:", err));
        };

        map.on("load", onLoad);

        return () => {
            map.off("load", onLoad);
            markerRef.current?.remove();
            markerRef.current = null;
            map.remove();
            mapRef.current = null;
        };
    }, []);

    const handleCloseSidebar = () => {
        markerRef.current?.remove();
        markerRef.current = null;
        setClickInfo(null);
    };

    return (
        <div className={`map-wrapper${clickInfo ? " has-sidebar" : ""}`}>
            <div ref={mapContainer} className="map-container" />
            <CoordSidebar info={clickInfo} onClose={handleCloseSidebar} />
            {/* ✅ React Portal — modal render ra document.body, không bị clip */}
            {svModal?.open &&
                createPortal(
                    <StreetViewModal
                        startId={svModal.startId}
                        allPoints={svPoints}
                        onClose={() => setSvModal(null)}
                        onNodeChange={(p) => {
                            mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 17 });
                        }}
                    />,
                    document.body
                )}
        </div>
    );
}

export default EsriSatelliteMap;