import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  ActivityBar,
  type PanelType,
  type MapType,
} from "./components/layout/Activitybar";

import type { ElectricPole } from "./features/electric-poles/api/electricPoles";
import type { StreetViewImage } from "./features/streetview/api/streetview";
import type { PoiWithSource } from "./features/poi/api/pois";

import { type PoiInfo } from "./features/map/components/MapPointInfoPanel/generalPanel";
import { StreetViewModal } from "./components/streetview/StreetViewModal/StreetViewModal";
import { API_BASE } from "./core/config";

import { useElectricPoles } from "./app/hooks/useElectricPoles";
import { SidebarContent } from "./app/SidebarContent";
import { MapContainerView } from "./components/layout/MapContainerView";
import { useAuth } from "./features/auth/useAuth";
import { type LayerVisibility, type LayerKey } from "./features/map/types/types";

import { createDefaultLayerVisibility } from "./features/map/components/EsriSatelliteMap/layers/registry";

import type { SearchResult } from "./features/search/api/search";

import { useStreetViewPoints } from "./features/map/components/EsriSatelliteMap/hooks/useStreetViewPoints";
import { useClickMarker } from "./features/map/components/EsriSatelliteMap/hooks/useClickMarker";
import { useClickPointInfo } from "./features/map/components/EsriSatelliteMap/hooks/useClickPointInfo";

import { useMapSearch } from "./features/search/hooks/useMapSearch";
import "./styles/App.css";
import { AuthGate } from "./features/auth/AuthGate";
import "./features/auth/AuthModal.css";

const SHOW_SWITCHER = import.meta.env.VITE_SHOW_MAP_SWITCHER === "true";
type NavigablePoi = PoiWithSource | SearchResult;

const isManagementPanel = (panel: PanelType | null) =>
  panel === "poleManagement" ||
  panel === "streetviewManagement" ||
  panel === "poiManagement";

// ✅ Fix bước 2: helper phân quyền dùng chung
const requiresAuthentication = (panel: PanelType | null) =>
  panel === "electric" ||
  panel === "poleManagement" ||
  panel === "streetviewManagement" ||
  panel === "poiManagement" ||
  panel === "contribute" ||
  panel === "settings";

export default function App() {
  const { user, token } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isAuthenticated = user !== null && token !== null;
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
  const [, setPoisVersion] = useState(0);

  const [streetViewNavigationRequest, setStreetViewNavigationRequest] = useState<{
    image: StreetViewImage;
    requestId: number;
  } | null>(null);

  const [poiNavigationRequest, setPoiNavigationRequest] = useState<{
    poi: NavigablePoi;
    requestId: number;
  } | null>(null);

  // Custom Hooks
  const { electricPoles, refreshPoles } = useElectricPoles();
  const { searchResults, searchLoading, searchError, handleSearch } = useMapSearch(activePanel);

  const { points: svPoints, geojson: svGeojson, error: svPointsError } =
    useStreetViewPoints(API_BASE, streetViewVersion);

  const { clickInfo, clear: clearClick } = useClickMarker(
    mapInstance,
    !isRecordingPoleLocation,
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

    if (isAuthModalOpen) return;
    if (isRecordingPoleLocation) return;
    if (activePanel === "contribute") return;
    setActivePanel("info");
  }, [clickInfo, isRecordingPoleLocation, activePanel, isAuthModalOpen]);

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

    if (
      typeof image.lng !== "number" ||
      !Number.isFinite(image.lng) ||
      typeof image.lat !== "number" ||
      !Number.isFinite(image.lat)
    ) {
      return;
    }

    const startId = Number(image.id);

    if (!Number.isInteger(startId)) {
      return;
    }

    mapInstance.flyTo({
      center: [image.lng, image.lat],
      zoom: 17,
      duration: 800,
    });

    setSvModal({ open: true, startId });
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
    if (isAuthModalOpen) return;
    // ✅ Fix bước 2: dùng helper
    if (requiresAuthentication(panel) && !isAuthenticated) {
      return;
    }

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

  // ✅ Fix bước 2: effect đăng xuất đóng tất cả panel được bảo vệ
  useEffect(() => {
    if (isAuthenticated || !requiresAuthentication(activePanel)) {
      return;
    }

    setActivePanel(null);
    setSelectedPoleId(null);
    poleLocationRecordedHandler.current = null;
    setIsRecordingPoleLocation(false);
  }, [isAuthenticated, activePanel]);

  // ✅ Fix bước 2: chặn mở panel "electric" khi chưa đăng nhập
  const handleElectricPoleSelect = useCallback(
    (pole: ElectricPole) => {
      if (!isAuthenticated) return;

      setSelectedPoleId(pole.id);
      setActivePanel("electric");
      setPoleNavigationRequest((current) => ({
        pole,
        requestId: (current?.requestId ?? 0) + 1,
      }));
    },
    [isAuthenticated],
  );

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

  const handleGoToPoi = useCallback((poi: NavigablePoi) => {
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

  const handleLoginClick = useCallback(() => {
    handlePanelClose();
    setIsAuthModalOpen(true);
  }, [handlePanelClose]);

  const handleAuthModalClose = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  // Tự đóng modal sau khi đăng nhập hoặc đăng ký thành công.
  useEffect(() => {
    if (isAuthenticated) {
      setIsAuthModalOpen(false);
    }
  }, [isAuthenticated]);

  // Đóng modal bằng phím Escape.
  useEffect(() => {
    if (!isAuthModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleAuthModalClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAuthModalOpen, handleAuthModalClose]);

  return (
    <div className="app-layout">
      {/* PANEL 1: ACTIVITY BAR */}
      <ActivityBar
        activePanel={activePanel}
        isAuthenticated={isAuthenticated}
        onPanelToggle={handlePanelToggle}
        onLoginClick={handleLoginClick}
      />

      {isAuthModalOpen &&
        createPortal(
          <div
            className="auth-modal-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                handleAuthModalClose();
              }
            }}
          >
            <section
              className="auth-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Đăng nhập hoặc đăng ký"
            >
              <button
                type="button"
                className="auth-modal__close"
                onClick={handleAuthModalClose}
                aria-label="Đóng cửa sổ đăng nhập"
              >
                ×
              </button>

              <AuthGate />
            </section>
          </div>,
          document.body,
        )}

      {/* PANEL 2: SIDEBAR */}
      {isSidebarOpen && (
        <aside
          className={`app-sidebar ${isWideSidebar ? "app-sidebar--wide" : ""}`}
        >
          <SidebarContent
            activePanel={activePanel}
            mapType={mapType}
            isAuthenticated={isAuthenticated}
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