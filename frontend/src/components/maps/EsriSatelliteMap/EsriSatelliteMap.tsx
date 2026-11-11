import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./EsriSatelliteMap.css";

import { addExtraLayers } from "./layers/addExtraLayers";
import { StreetViewModal } from "../../streetview/StreetViewModal/StreetViewModal";
import { CoordSidebar, type PoiInfo } from "../../sidebar/CoordSidebar/CoordSidebar";
import { PlaceDetailSidebar } from "../../sidebar/PlaceDetailSidebar/PlaceDetailSidebar";
import { SearchPanel } from "../../sidebar/SearchSidebar/SearchPanel";
import type { SearchResult } from "../../../api/search";
import type { MapType, PanelType } from "../../layout/Activitybar";
import { ContributePanel } from "../../contribute/ContributePanel";
import { EXTRA_LAYERS, extraTileUrl } from "./layers/registry";
import {
    API_BASE,
    ESRI_SATELLITE_TILE_URL,
    getMapLibreWorkerUrl,
} from "../../../config";
import { bindUserPoiHover } from "./layers/bindUserPoiHover";
import { ESRI_INITIAL_VIEW } from "./constants";

import { addRoadsLayer } from "./layers/roadsLayer";
import { ensureStreetViewLayer, setStreetViewData } from "./layers/streetViewLayer";
import {
    addElectricPoleLayer,
    ELECTRIC_POLE_LAYER_ID,
    setElectricPoleData,
} from "./layers/electricPoleLayer";
import type { ElectricPole } from "../../../api/electricPoles";
import type { PoiItem } from "../../../api/pois"; // Import thêm kiểu dữ liệu PoiItem
import { useStreetViewPoints } from "./hooks/useStreetViewPoints";
import { useClickMarker } from "./hooks/useClickMarker";
import { useClickPointInfo } from "./hooks/useClickPointInfo";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayersPanel, SettingsPanel, DEFAULT_LAYERS } from "../../layout/panels";
import type { LayerKey, LayerVisibility } from "../../layout/panels";
import { applyLayerVisibility } from "./layers/applyLayerVisibility";
import { showSearchResult } from "./layers/searchResultLayer";
import type { StreetViewImage } from "../../../api/streetview";

interface Props {
    activePanel?: PanelType | null;
    onAutoShowInfo?: () => void;
    onPanelClose?: () => void;
    electricPoles: ElectricPole[];
    onElectricPoleSelect: (pole: ElectricPole) => void;
    isRecordingPoleLocation: boolean;
    onPoleLocationRecorded: (location: { lng: number; lat: number }) => void;
    poleNavigationRequest: { pole: ElectricPole; requestId: number } | null;
    searchResults: SearchResult[];
    searchLoading: boolean;
    searchError: string | null;
    onSearch: (query: string) => void;
    mapType: MapType;
    onMapTypeChange: (m: MapType) => void;
    showMapSwitcher: boolean;
    streetViewVersion?: number;
    streetViewNavigationRequest?: { image: StreetViewImage; requestId: number } | null;
    poiNavigationRequest?: { poi: PoiItem; requestId: number } | null; // Bổ sung prop mới
}

function EsriSatelliteMap({
    activePanel = null,
    onAutoShowInfo,
    onPanelClose,
    electricPoles,
    onElectricPoleSelect,
    isRecordingPoleLocation,
    onPoleLocationRecorded,
    poleNavigationRequest,
    searchResults,
    searchLoading,
    searchError,
    onSearch,
    mapType,
    onMapTypeChange,
    showMapSwitcher,
    streetViewNavigationRequest,
    poiNavigationRequest, // Nhận prop ở đây
}: Props) {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);

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

    // ================= StreetView points =================
    const {
        points,
        geojson,
        error: svPointsError,
    } = useStreetViewPoints(API_BASE);

    // ================= Click marker + point info =================
    const { clickInfo, clear } = useClickMarker(
        mapInstance,
        activePanel === "contribute" || isRecordingPoleLocation
    );
    const [selectedPoi, setSelectedPoi] = useState<{
        poi: PoiInfo;
        clickKey: string;
    } | null>(null);

    useEffect(() => {
        if (activePanel !== "info") clear();
    }, [activePanel, clear]);

    const {
        data: pointInfo,
        loading: pointInfoLoading,
        error: pointInfoError,
    } = useClickPointInfo(API_BASE, clickInfo);

    useEffect(() => {
        if (clickInfo && onAutoShowInfo) {
            onAutoShowInfo();
        }
    }, [clickInfo, onAutoShowInfo]);

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
                glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
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

            transformRequest: (url) => {
                if (url.startsWith("/")) {
                    return {
                        url: new URL(url, window.location.origin).href,
                    };
                }
                return { url };
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
            addExtraLayers(map);
            bindUserPoiHover(map);
            ensureStreetViewLayer({
                map,
                onIconClick: (id) => setSvModal({ open: true, startId: id }),
            });
            addElectricPoleLayer(map);
            mapRef.current = map;
            setMapInstance(map);
            setMapReady(true);
        });

        return () => {
            map.remove();
            mapRef.current = null;
            setMapInstance(null);
            setMapReady(false);
        };
    }, []);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        setElectricPoleData(mapRef.current, electricPoles);
    }, [mapReady, electricPoles]);

    useEffect(() => {
        const map = mapInstance;
        if (!map || !map.getLayer(ELECTRIC_POLE_LAYER_ID)) return;

        const onPoleClick = (event: maplibregl.MapLayerMouseEvent) => {
            if (isRecordingPoleLocation) return;
            const poleId = Number(event.features?.[0]?.properties?.poleId);
            const pole = electricPoles.find((item) => item.id === poleId);
            if (pole) onElectricPoleSelect(pole);
        };
        const setPointerCursor = () => {
            map.getCanvas().style.cursor = "pointer";
        };
        const clearPointerCursor = () => {
            map.getCanvas().style.cursor = "";
        };

        map.on("click", ELECTRIC_POLE_LAYER_ID, onPoleClick);
        map.on("mouseenter", ELECTRIC_POLE_LAYER_ID, setPointerCursor);
        map.on("mouseleave", ELECTRIC_POLE_LAYER_ID, clearPointerCursor);
        return () => {
            map.off("click", ELECTRIC_POLE_LAYER_ID, onPoleClick);
            map.off("mouseenter", ELECTRIC_POLE_LAYER_ID, setPointerCursor);
            map.off("mouseleave", ELECTRIC_POLE_LAYER_ID, clearPointerCursor);
        };
    }, [mapInstance, electricPoles, isRecordingPoleLocation, onElectricPoleSelect]);

    useEffect(() => {
        if (!mapInstance || !isRecordingPoleLocation) return;

        const handleMapClick = (event: maplibregl.MapMouseEvent) => {
            onPoleLocationRecorded({
                lng: event.lngLat.lng,
                lat: event.lngLat.lat,
            });
        };
        mapInstance.on("click", handleMapClick);
        return () => {
            mapInstance.off("click", handleMapClick);
        };
    }, [mapInstance, isRecordingPoleLocation, onPoleLocationRecorded]);

    useEffect(() => {
        if (!mapInstance || !poleNavigationRequest) return;
        mapInstance.easeTo({
            center: [poleNavigationRequest.pole.lng, poleNavigationRequest.pole.lat],
            duration: 700,
        });
    }, [mapInstance, poleNavigationRequest]);

    // ================= Xử lý Street View Navigation Request =================
    useEffect(() => {
        if (!mapInstance || !streetViewNavigationRequest) return;
        const { image } = streetViewNavigationRequest;
        mapInstance.flyTo({
            center: [image.lng, image.lat],
            zoom: 17,
            duration: 800,
        });
        setSvModal({ open: true, startId: image.id });
    }, [mapInstance, streetViewNavigationRequest]);

    // ================= Xử lý POI Navigation Request =================
    useEffect(() => {
        if (!mapInstance || !poiNavigationRequest) return;
        const { poi } = poiNavigationRequest;
        mapInstance.flyTo({
            center: [poi.lng, poi.lat],
            zoom: 17,
            duration: 800,
        });
    }, [mapInstance, poiNavigationRequest]);

    // ================= Update SV data =================
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
    const handleOpenStreetViewById = useCallback(
        (id: number) => {
            const point = points.find((p) => Number(p.id) === id);
            if (point && mapRef.current) {
                mapRef.current.flyTo({
                    center: [point.lng, point.lat],
                    zoom: 17,
                    duration: 800,
                });
            }
            setSvModal({ open: true, startId: id });
        },
        [points]
    );

    const handlePoiClick = useCallback(
        (poi: PoiInfo) => {
            if (poi.streetview_id != null) {
                handleOpenStreetViewById(poi.streetview_id);
                return;
            }
            mapRef.current?.flyTo({
                center: [poi.lng, poi.lat],
                zoom: 17,
                duration: 600,
            });
        },
        [handleOpenStreetViewById]
    );

    const handlePoiDetails = useCallback((poi: PoiInfo) => {
        setSelectedPoi({
            poi,
            clickKey: clickInfo ? `${clickInfo.lng}|${clickInfo.lat}` : "",
        });
        mapRef.current?.flyTo({
            center: [poi.lng, poi.lat],
            zoom: 17,
            duration: 600,
        });
    }, [clickInfo]);

    const handleSearchResultClick = (result: SearchResult) => {
        if (mapInstance) showSearchResult(mapInstance, result);
    };

    const handleClose = () => {
        clear();
        onPanelClose?.();
    };

    const handleClosePlaceDetails = () => {
        setSelectedPoi(null);
        clear();
        onPanelClose?.();
    };

    const clickKey = clickInfo ? `${clickInfo.lng}|${clickInfo.lat}` : "";
    const activePoi = selectedPoi?.clickKey === clickKey ? selectedPoi.poi : null;

    const handleContributeCreated = useCallback(
        (poi: { id: number; lng: number; lat: number }) => {
            const map = mapRef.current;
            if (!map) return;

            map.flyTo({ center: [poi.lng, poi.lat], zoom: 17, duration: 800 });

            const def = EXTRA_LAYERS.find((d) => d.key === "userPois");
            if (!def) return;

            if (map.getLayer(def.layerId)) map.removeLayer(def.layerId);
            if (map.getSource(def.sourceId)) map.removeSource(def.sourceId);

            map.addSource(def.sourceId, {
                type: "vector",
                tiles: [extraTileUrl(def, true)],
                minzoom: 0,
                maxzoom: def.maxzoom ?? 14,
            });
            def.beforeAdd?.(map);
            map.addLayer(def.spec(def.sourceId, def.layerId));
        },
        []
    );

    const showInfo = activePanel === "info";
    const showLayers = activePanel === "layers";
    const showSettings = activePanel === "settings";
    const showContribute = activePanel === "contribute";
    const hasSidebar =
        showInfo ||
        showLayers ||
        showSettings ||
        showContribute ||
        activePanel === "search" ||
        activePanel === "electric" ||
        activePanel === "poleManagement" ||
        activePanel === "poiManagement"; // Bổ sung activePanel cho poiManagement

    return (
        <div className={`map-wrapper${hasSidebar ? " has-sidebar" : ""}`}>
            <div ref={mapContainer} className="map-container" />

            {showInfo && activePoi ? (
                <PlaceDetailSidebar
                    place={activePoi}
                    apiBase={API_BASE}
                    onBack={() => setSelectedPoi(null)}
                    onClose={handleClosePlaceDetails}
                    onOpenStreetView={handleOpenStreetViewById}
                />
            ) : showInfo && (
                <CoordSidebar
                    info={clickInfo}
                    onClose={handleClose}
                    road={pointInfo?.road}
                    streetview={pointInfo?.streetview}
                    address={pointInfo?.address}
                    pois={pointInfo?.pois}
                    nearbyPoles={pointInfo?.nearby_poles}
                    loading={pointInfoLoading}
                    addressLoading={pointInfoLoading}
                    poisLoading={pointInfoLoading}
                    error={pointInfoError?.message ?? null}
                    onOpenStreetView={handleOpenStreetViewById}
                    onPoiClick={handlePoiClick}
                    onPoiDetails={handlePoiDetails}
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

            {showSettings && (
                <SettingsPanel
                    onClose={() => onPanelClose?.()}
                    mapType={mapType}
                    onMapTypeChange={onMapTypeChange}
                    showMapSwitcher={showMapSwitcher}
                />
            )}

            {activePanel === "search" && (
                <SearchPanel
                    onClose={handleClose}
                    results={searchResults}
                    loading={searchLoading}
                    error={searchError}
                    onSearch={onSearch}
                    onResultClick={handleSearchResultClick}
                />
            )}

            {showContribute && (
                <ContributePanel
                    onClose={() => onPanelClose?.()}
                    mapInstance={mapInstance}
                    onCreated={handleContributeCreated}
                />
            )}

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