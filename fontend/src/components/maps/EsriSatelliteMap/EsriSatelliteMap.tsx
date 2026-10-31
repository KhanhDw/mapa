import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./EsriSatelliteMap.css";

import { StreetViewModal } from "../../streetview/StreetViewModal/StreetViewModal";
import { CoordSidebar, type PoiInfo } from "../../sidebar/CoordSidebar/CoordSidebar";
import type { PanelType } from "../../layout/Activitybar";
import { addPoisLayer } from "./layers/poisLayer";

import {
    API_BASE,
    ESRI_SATELLITE_TILE_URL,
    getMapLibreWorkerUrl,
} from "../../../config";

import { ESRI_INITIAL_VIEW } from "./constants";

import { addRoadsLayer } from "./layers/roadsLayer";
import { ensureStreetViewLayer, setStreetViewData } from "./layers/streetViewLayer";
import { useStreetViewPoints } from "./hooks/useStreetViewPoints";
import { useClickMarker } from "./hooks/useClickMarker";
import { useClickPointInfo } from "./hooks/useClickPointInfo";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayersPanel, SettingsPanel, DEFAULT_LAYERS } from "../../layout/panels";
import type { LayerKey, LayerVisibility } from "../../layout/panels";
import { applyLayerVisibility } from "./layers/applyLayerVisibility";

interface Props {
    activePanel?: PanelType | null;
    onAutoShowInfo?: () => void;
    onPanelClose?: () => void;
}

function EsriSatelliteMap({
    activePanel = null,
    onAutoShowInfo,
    onPanelClose,
}: Props) {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [mapReady, setMapReady] = useState(false);

    const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
    const toggleLayer = useCallback((key: LayerKey) => {
        setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        applyLayerVisibility(mapRef.current, layers);
    }, [mapReady, layers]);

    const [svModal, setSvModal] = useState<{
        open: boolean;
        startId: number;
    } | null>(null);

    // ================= StreetView points (fetch 1 lần) =================
    const {
        points,
        geojson,
        error: svPointsError,
    } = useStreetViewPoints(API_BASE);

    // ================= Click marker + point info =================
    const { clickInfo, clear } = useClickMarker(mapReady ? mapRef.current : null);

    useEffect(() => {
        if (activePanel !== "info") clear();
    }, [activePanel, clear]);

    const {
        data: pointInfo,
        loading: pointInfoLoading,
        error: pointInfoError,
    } = useClickPointInfo(API_BASE, clickInfo);

    useEffect(() => {
        if (clickInfo && onAutoShowInfo && activePanel !== "info") {
            onAutoShowInfo();
        }
    }, [clickInfo, onAutoShowInfo, activePanel]);

    // ======================================================
    // Init map (chỉ 1 lần)
    // ======================================================
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        maplibregl.setWorkerUrl(getMapLibreWorkerUrl(maplibregl.getVersion()));

        const map = new maplibregl.Map({
            container: mapContainer.current,
            ...ESRI_INITIAL_VIEW,
            style: {
                version: 8,
                glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
            addPoisLayer(map);
            ensureStreetViewLayer({
                map,
                onIconClick: (id) => setSvModal({ open: true, startId: id }),
            });
            setMapReady(true);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
    }, []);

    // ================= Update SV data khi geojson sẵn sàng =================
    useEffect(() => {
        if (!mapReady || !mapRef.current || !geojson) return;
        setStreetViewData(mapRef.current, geojson);
    }, [mapReady, geojson]);

    // ================= Dev logs =================
    useEffect(() => {
        if (svPointsError) console.error("[sv-points] fetch error:", svPointsError);
    }, [svPointsError]);

    useEffect(() => {
        if (pointInfoError) console.error("[point-info] fetch error:", pointInfoError);
    }, [pointInfoError]);

    // ======================================================
    // Handlers
    // ======================================================
    const handleOpenStreetViewById = (id: number) => {
        const point = points.find((p) => Number(p.id) === id);
        if (point && mapRef.current) {
            mapRef.current.flyTo({
                center: [point.lng, point.lat],
                zoom: 17,
                duration: 800,
            });
        }
        setSvModal({ open: true, startId: id });
    };

    const handlePoiClick = (poi: PoiInfo) => {
        if (poi.streetview_id != null) {
            handleOpenStreetViewById(poi.streetview_id);
            return;
        }
        mapRef.current?.flyTo({
            center: [poi.lng, poi.lat],
            zoom: 17,
            duration: 600,
        });
    };

    const handleClose = () => onPanelClose?.();

    const showInfo = activePanel === "info";
    const showLayers = activePanel === "layers";
    const showSettings = activePanel === "settings";
    const hasSidebar = showInfo || showLayers || showSettings;

    return (
        <div className={`map-wrapper${hasSidebar ? " has-sidebar" : ""}`}>
            <div ref={mapContainer} className="map-container" />

            {showInfo && (
                <CoordSidebar
                    info={clickInfo}
                    onClose={handleClose}
                    road={pointInfo?.road}
                    streetview={pointInfo?.streetview}
                    address={pointInfo?.address}
                    pois={pointInfo?.pois}
                    loading={pointInfoLoading}
                    addressLoading={pointInfoLoading}
                    poisLoading={pointInfoLoading}
                    error={pointInfoError?.message ?? null}
                    onOpenStreetView={handleOpenStreetViewById}
                    onPoiClick={handlePoiClick}
                    onPoiStreetView={handleOpenStreetViewById}
                />
            )}

            {showLayers && (
                <LayersPanel
                    layers={layers}
                    onToggle={toggleLayer}
                    onClose={() => onPanelClose?.()}
                />
            )}
            {showSettings && <SettingsPanel onClose={() => onPanelClose?.()} />}

            {svModal?.open &&
                createPortal(
                    <StreetViewModal
                        startId={svModal.startId}
                        allPoints={points}
                        onClose={() => setSvModal(null)}
                        onNodeChange={(p) =>
                            mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 17 })
                        }
                    />,
                    document.body
                )}
        </div>
    );
}

export default EsriSatelliteMap;