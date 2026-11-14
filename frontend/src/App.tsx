import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  ActivityBar,
  type PanelType,
  type MapType,
} from "./components/layout/Activitybar";
import { type LayerVisibility, type LayerKey } from "./components/layout/panels";
import { createDefaultLayerVisibility } from "./components/maps/EsriSatelliteMap/layers/registry";

import type { ElectricPole } from "./api/electricPoles";
import type { StreetViewImage } from "./api/streetview";
import type { PoiItem } from "./api/pois";

import { useStreetViewPoints } from "./components/maps/EsriSatelliteMap/hooks/useStreetViewPoints";
import { useClickMarker } from "./components/maps/EsriSatelliteMap/hooks/useClickMarker";
import { useClickPointInfo } from "./components/maps/EsriSatelliteMap/hooks/useClickPointInfo";
import { type PoiInfo } from "./components/layout/panels/generalPanel/generalPanel";
import { StreetViewModal } from "./components/streetview/StreetViewModal/StreetViewModal";
import { API_BASE } from "./config";

import { useMapSearch } from "./app/hooks/useMapSearch";
import { useElectricPoles } from "./app/hooks/useElectricPoles";
import { SidebarContent } from "./app/SidebarContent";
import { MapContainerView } from "./components/layout/MapContainerView";

import "./App.css";

const SHOW_SWITCHER = import.meta.env.VITE_SHOW_MAP_SWITCHER === "true";

const isManagementPanel = (panel: PanelType | null) =>
  panel === "poleManagement" ||
  panel === "streetviewManagement" ||
  panel === "poiManagement";

export default function App() {
  const [mapType, setMapType] = useState<MapType>("esri");
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [selectedPoleId, setSelectedPoleId] = useState<number | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);

  const [svModal, setSvModal] = useState<{
    open: boolean;
    startId: number;
  } | null>(null);

  const [selectedPoi, setSelectedPoi] = useState<{
    poi: PoiInfo;
    clickKey: string;
  } | null>(null);

  const [layers, setLayers] = useState<LayerVisibility>(() =>
    createDefaultLayerVisibility(),
  );

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [isRecordingPoleLocation, setIsRecordingPoleLocation] = useState(false);
  const poleLocationRecordedHandler = useRef<
    ((location: { lng: number; lat: number }) => void) | null
  >(null);

  const [poleNavigationRequest, setPoleNavigationRequest] = useState<{
    pole: ElectricPole;
    requestId: number;
  } | null>(null);

  const [streetViewVersion, setStreetViewVersion] = useState(0);
  const [poisVersion, setPoisVersion] = useState(0);

  const [streetViewNavigationRequest, setStreetViewNavigationRequest] = useState<{
    image: StreetViewImage;
    requestId: number;
  } | null>(null);

  const [poiNavigationRequest, setPoiNavigationRequest] = useState<{
    poi: PoiItem;
    requestId: number;
  } | null>(null);

  // Custom Hooks
  const { electricPoles, refreshPoles } = useElectricPoles();
  const { searchResults, searchLoading, searchError, handleSearch } = useMapSearch(activePanel);

  const { points: svPoints, geojson: svGeojson, error: svPointsError } =
    useStreetViewPoints(API_BASE, streetViewVersion);

  const { clickInfo, clear: clearClick } = useClickMarker(
    mapInstance,
    !isRecordingPoleLocation
  );

  const {
    data: pointInfo,
    loading: pointInfoLoading,
    error: pointInfoError,
  } = useClickPointInfo(API_BASE, clickInfo);

  // Auto-mở info panel khi có click mới
  const prevClickKeyRef = useRef<string>("");
  useEffect(() => {
    if (!clickInfo) {
      prevClickKeyRef.current = "";
      return;
    }
    const newKey = `${clickInfo.lng}|${clickInfo.lat}`;
    if (prevClickKeyRef.current === newKey) return;
    prevClickKeyRef.current = newKey;

    if (isRecordingPoleLocation) return;
    if (activePanel === "contribute") return;
    setActivePanel("info");
  }, [clickInfo, isRecordingPoleLocation, activePanel]);

  const clearClickRef = useRef(clearClick);
  useEffect(() => {
    clearClickRef.current = clearClick;
  }, [clearClick]);

  const prevActivePanelRef = useRef<PanelType | null>(activePanel);
  useEffect(() => {
    const wasInfo = prevActivePanelRef.current === "info";
    const isInfo = activePanel === "info";
    if (wasInfo && !isInfo) {
      clearClickRef.current();
      setSelectedPoi(null);
    }
    prevActivePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    if (svPointsError) console.error("[sv-points] fetch error:", svPointsError);
  }, [svPointsError]);

  useEffect(() => {
    if (pointInfoError) console.error("[point-info] fetch error:", pointInfoError);
  }, [pointInfoError]);

  useEffect(() => {
    if (!mapInstance || !poleNavigationRequest) return;
    mapInstance.easeTo({
      center: [poleNavigationRequest.pole.lng, poleNavigationRequest.pole.lat],
      duration: 700,
    });
  }, [mapInstance, poleNavigationRequest]);

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

  useEffect(() => {
    if (!mapInstance || !poiNavigationRequest) return;
    const { poi } = poiNavigationRequest;
    mapInstance.flyTo({
      center: [poi.lng, poi.lat],
      zoom: 17,
      duration: 800,
    });
  }, [mapInstance, poiNavigationRequest]);

  const handlePanelToggle = (panel: PanelType) => {
    const next = activePanel === panel ? null : panel;
    if (activePanel === "electric" || panel === "electric") {
      setSelectedPoleId(null);
    }
    if (isManagementPanel(panel) || isManagementPanel(activePanel)) {
      poleLocationRecordedHandler.current = null;
      setIsRecordingPoleLocation(false);
    }
    setActivePanel(next);
  };

  const handleElectricPoleSelect = useCallback((pole: ElectricPole) => {
    setSelectedPoleId(pole.id);
    setActivePanel("electric");
    setPoleNavigationRequest((current) => ({
      pole,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const handlePoleLocationRecorded = useCallback(
    (location: { lng: number; lat: number }) => {
      poleLocationRecordedHandler.current?.(location);
      poleLocationRecordedHandler.current = null;
      setIsRecordingPoleLocation(false);
    },
    [],
  );

  const handleGoToPole = useCallback((pole: ElectricPole) => {
    setPoleNavigationRequest((current) => ({
      pole,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const handleGoToStreetViewImage = useCallback((image: StreetViewImage) => {
    setStreetViewNavigationRequest((current) => ({
      image,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const handleGoToPoi = useCallback((poi: PoiItem) => {
    setPoiNavigationRequest((current) => ({
      poi,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const handleStartPoleLocationRecording = useCallback(
    (onLocationRecorded: (location: { lng: number; lat: number }) => void) => {
      poleLocationRecordedHandler.current = onLocationRecorded;
      setIsRecordingPoleLocation(true);
    },
    [],
  );

  const handleStopPoleLocationRecording = useCallback(() => {
    poleLocationRecordedHandler.current = null;
    setIsRecordingPoleLocation(false);
  }, []);

  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
    setSelectedPoleId(null);
    poleLocationRecordedHandler.current = null;
    setIsRecordingPoleLocation(false);
  }, []);

  const handleSearchResultClick = useCallback(
    (result: any) => {
      if (mapType !== "esri") {
        return;
      }
      if (!mapInstance) return;

      const r = result as {
        lng?: number;
        lat?: number;
        center?: [number, number];
        geometry?: { coordinates?: [number, number] };
      };
      const lng = r.lng ?? r.center?.[0] ?? r.geometry?.coordinates?.[0];
      const lat = r.lat ?? r.center?.[1] ?? r.geometry?.coordinates?.[1];

      if (typeof lng === "number" && typeof lat === "number") {
        mapInstance.flyTo({ center: [lng, lat], zoom: 17, duration: 800 });
      }
    },
    [mapType, mapInstance],
  );

  const handleContributeCreated = useCallback(() => {
    setStreetViewVersion((v) => v + 1);
    setPoisVersion((v) => v + 1);
    handlePanelClose();
  }, [handlePanelClose]);

  const handleMapInstanceReady = useCallback((map: MapLibreMap) => {
    setMapInstance(map);
  }, []);

  const handleStreetViewIconClick = useCallback((id: number) => {
    setSvModal({ open: true, startId: id });
  }, []);

  const handleOpenStreetViewById = useCallback(
    (id: number) => {
      const point = svPoints.find((p) => Number(p.id) === id);
      if (point && mapInstance) {
        mapInstance.flyTo({
          center: [point.lng, point.lat],
          zoom: 17,
          duration: 800,
        });
      }
      setSvModal({ open: true, startId: id });
    },
    [svPoints, mapInstance],
  );

  const handlePoiClick = useCallback(
    (poi: PoiInfo) => {
      if (poi.streetview_id != null) {
        handleOpenStreetViewById(poi.streetview_id);
        return;
      }
      mapInstance?.flyTo({
        center: [poi.lng, poi.lat],
        zoom: 17,
        duration: 600,
      });
    },
    [handleOpenStreetViewById, mapInstance],
  );

  const handlePoiDetails = useCallback(
    (poi: PoiInfo) => {
      setSelectedPoi({
        poi,
        clickKey: clickInfo ? `${clickInfo.lng}|${clickInfo.lat}` : "",
      });
      mapInstance?.flyTo({
        center: [poi.lng, poi.lat],
        zoom: 17,
        duration: 600,
      });
    },
    [clickInfo, mapInstance],
  );

  const handlePoiStreetView = useCallback(
    (poiOrId: PoiInfo | number) => {
      if (typeof poiOrId === "number") {
        handleOpenStreetViewById(poiOrId);
        return;
      }
      if (poiOrId.streetview_id != null) {
        handleOpenStreetViewById(poiOrId.streetview_id);
      } else {
        mapInstance?.flyTo({
          center: [poiOrId.lng, poiOrId.lat],
          zoom: 17,
          duration: 600,
        });
      }
    },
    [handleOpenStreetViewById, mapInstance],
  );

  const handleCloseLocationDetails = useCallback(() => {
    clearClick();
    setSelectedPoi(null);
    handlePanelClose();
  }, [clearClick, handlePanelClose]);

  const isSidebarOpen = activePanel !== null;
  const isWideSidebar = isManagementPanel(activePanel);

  const clickKey = clickInfo ? `${clickInfo.lng}|${clickInfo.lat}` : "";
  const activePoi = selectedPoi?.clickKey === clickKey ? selectedPoi.poi : null;
  const showLocationSidebar = activePanel === "info";

  return (
    <div className="app-layout">
      {/* PANEL 1: ACTIVITY BAR */}
      <ActivityBar
        activePanel={activePanel}
        onPanelToggle={handlePanelToggle}
      />

      {/* PANEL 2: SIDEBAR */}
      {isSidebarOpen && (
        <aside
          className={`app-sidebar ${isWideSidebar ? "app-sidebar--wide" : ""}`}
        >
          <SidebarContent
            activePanel={activePanel}
            mapType={mapType}
            setMapType={setMapType}
            showMapSwitcher={SHOW_SWITCHER}
            layers={layers}
            toggleLayer={toggleLayer}
            onClose={handlePanelClose}
            searchResults={searchResults}
            searchLoading={searchLoading}
            searchError={searchError}
            onSearch={handleSearch}
            onSearchResultClick={handleSearchResultClick}
            mapInstance={mapInstance}
            onContributeCreated={handleContributeCreated}
            refreshPoles={refreshPoles}
            isRecordingPoleLocation={isRecordingPoleLocation}
            onStartLocationRecording={handleStartPoleLocationRecording}
            onStopLocationRecording={handleStopPoleLocationRecording}
            onGoToPole={handleGoToPole}
            onGoToImage={handleGoToStreetViewImage}
            onGoToPoi={handleGoToPoi}
            setStreetViewVersion={setStreetViewVersion}
            setPoisVersion={setPoisVersion}
            electricPoles={electricPoles}
            selectedPoleId={selectedPoleId}
            showLocationSidebar={showLocationSidebar}
            activePoi={activePoi}
            clickInfo={clickInfo}
            pointInfo={pointInfo}
            pointInfoLoading={pointInfoLoading}
            pointInfoError={pointInfoError}
            apiBase={API_BASE}
            setSelectedPoi={setSelectedPoi}
            handleCloseLocationDetails={handleCloseLocationDetails}
            handleOpenStreetViewById={handleOpenStreetViewById}
            handlePoiClick={handlePoiClick}
            handlePoiDetails={handlePoiDetails}
            handlePoiStreetView={handlePoiStreetView}
          />
        </aside>
      )}

      {/* PANEL 3: MAP VIEW */}
      <main className="app-map-panel">
        <MapContainerView
          mapType={mapType}
          mapKey={mapKey}
          setMapKey={setMapKey}
          showLocationSidebar={showLocationSidebar}
          electricPoles={electricPoles}
          onElectricPoleSelect={handleElectricPoleSelect}
          isRecordingPoleLocation={isRecordingPoleLocation}
          onPoleLocationRecorded={handlePoleLocationRecorded}
          layers={layers}
          onMapInstanceReady={handleMapInstanceReady}
          svGeojson={svGeojson}
          onStreetViewIconClick={handleStreetViewIconClick}
        />

        {svModal?.open &&
          createPortal(
            <StreetViewModal
              startId={svModal.startId}
              allPoints={svPoints}
              onClose={() => setSvModal(null)}
              onNodeChange={(p) =>
                mapInstance?.flyTo({ center: [p.lng, p.lat], zoom: 17 })
              }
            />,
            document.body,
          )}
      </main>
    </div>
  );
}