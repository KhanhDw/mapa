import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./EsriSatelliteMap.css";
import { getVersion, setWorkerUrl } from "maplibre-gl";

import {
    StreetViewModal,
} from "../../streetview/StreetViewModal/StreetViewModal";
import {
    CoordSidebar,
} from "../../sidebar/CoordSidebar/CoordSidebar";
import {
    API_BASE,
    ESRI_SATELLITE_TILE_URL,
    getMapLibreWorkerUrl,
} from "../../../config";

import { ESRI_INITIAL_VIEW, SV_LAYER_ID } from "./constants";
import { addRoadsLayer } from "./layers/roadsLayer";
import { addStreetViewLayer } from "./layers/streetViewLayer";
import { useStreetViewPoints } from "./hooks/useStreetViewPoints";
import { useClickMarker } from "./hooks/useClickMarker";

function EsriSatelliteMap() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [mapReady, setMapReady] = useState(false);

    const [svModal, setSvModal] = useState<{
        open: boolean;
        startId: number;
    } | null>(null);

    // Fetch points — độc lập với map (song song)
    const { points, geojson, error } = useStreetViewPoints(API_BASE);

    // Marker + clickInfo
    const { clickInfo, clear } = useClickMarker(
        mapReady ? mapRef.current : null
    );

    // ============ Khởi tạo map ============
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        setWorkerUrl(getMapLibreWorkerUrl(getVersion()));

        const map = new maplibregl.Map({
            container: mapContainer.current,
            ...ESRI_INITIAL_VIEW,
            style: {
                version: 8,
                sources: {
                    "satellite-esri": {
                        type: "raster",
                        tiles: [ESRI_SATELLITE_TILE_URL],
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

        map.on("load", () => {
            addRoadsLayer(map);
            setMapReady(true);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
    }, []);

    // ============ Gắn layer street view khi map + data sẵn sàng ============
    useEffect(() => {
        if (!mapReady || !mapRef.current || !geojson) return;
        const map = mapRef.current;
        if (map.getLayer(SV_LAYER_ID)) return;

        addStreetViewLayer({
            map,
            geojson,
            onIconClick: (id) => setSvModal({ open: true, startId: id }),
        });
    }, [mapReady, geojson]);

    // ============ Log lỗi fetch (dev convenience) ============
    useEffect(() => {
        if (error) console.error("[sv-points] fetch error:", error);
    }, [error]);

    return (
        <div className={`map-wrapper${clickInfo ? " has-sidebar" : ""}`}>
            <div ref={mapContainer} className="map-container" />
            <CoordSidebar info={clickInfo} onClose={clear} />

            {svModal?.open &&
                createPortal(
                    <StreetViewModal
                        startId={svModal.startId}
                        allPoints={points}
                        onClose={() => setSvModal(null)}
                        onNodeChange={(p) => {
                            mapRef.current?.flyTo({
                                center: [p.lng, p.lat],
                                zoom: 17,
                            });
                        }}
                    />,
                    document.body
                )}
        </div>
    );
}

export default EsriSatelliteMap;