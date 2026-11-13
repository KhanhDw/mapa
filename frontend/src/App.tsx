import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  ActivityBar,
  type PanelType,
  type MapType,
} from "./components/layout/Activitybar";
import {
  SearchPanel,
  ElectricPanel,
  SettingsPanel,
  type SearchResult,
  type LayerVisibility,
  type LayerKey,
} from "./components/layout/panels";
import { LayersPanel } from "./components/layout/panels/LayersPanel";
import { createDefaultLayerVisibility } from "./components/maps/EsriSatelliteMap/layers/registry";
import { ContributePanel } from "./components/layout/panels/contribute/ContributePanel";
import { PoleManagementPanel } from "./components/layout/panels/ElectricPanel/PoleManagementPanel";
import { StreetViewManagementPanel } from "./components/layout/panels/StreetViewManagementPanel";
import { PoiManagementPanel } from "./components/layout/panels/PoiManagementPanel";

import { fetchElectricPoles } from "./api/electricPoles";
import type { ElectricPole } from "./api/electricPoles";
import type { StreetViewImage } from "./api/streetview";
import type { PoiItem } from "./api/pois";
import { searchMap } from "./api/search";

import { ErrorBoundary } from "./components/ErrorBoundary";
import EsriSatelliteMap from "./components/maps/EsriSatelliteMap/EsriSatelliteMap";
import SatelliteMap from "./components/maps/SatelliteMap/SatelliteMap";
import OsmPolygonMap from "./components/maps/OsmPolygonMap/OsmPolygonMap";
import TestPSV from "./components/dev/TestPSV";

import { useStreetViewPoints } from "./components/maps/EsriSatelliteMap/hooks/useStreetViewPoints";
import { useClickMarker } from "./components/maps/EsriSatelliteMap/hooks/useClickMarker";
import { useClickPointInfo } from "./components/maps/EsriSatelliteMap/hooks/useClickPointInfo";
import {
  GeneralPanel,
  type PoiInfo,
} from "./components/layout/panels/generalPanel/generalPanel";
import { PlaceDetailSidebar } from "./components/layout/panels/PlaceDetailSidebar/PlaceDetailSidebar";
import { StreetViewModal } from "./components/streetview/StreetViewModal/StreetViewModal";
import { API_BASE } from "./config";

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
  const [electricPoles, setElectricPoles] = useState<ElectricPole[]>([]);
  const [electricPolesVersion, setElectricPolesVersion] = useState(0);
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

  // ✅ Mới — chỉ bật 5 lớp ưu tiên
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

  // Version counters dùng để refetch / re-render dữ liệu sau khi management thay đổi.
  // NOTE: useStreetViewPoints hiện chưa nhận version — cần sửa hook:
  //   useStreetViewPoints(API_BASE, streetViewVersion)
  // để streetview points thực sự được refetch sau khi đổi dữ liệu.
  const [streetViewVersion, setStreetViewVersion] = useState(0);
  const [poisVersion, setPoisVersion] = useState(0);
  void streetViewVersion;
  void poisVersion;

  const [streetViewNavigationRequest, setStreetViewNavigationRequest] = useState<{
    image: StreetViewImage;
    requestId: number;
  } | null>(null);

  const [poiNavigationRequest, setPoiNavigationRequest] = useState<{
    poi: PoiItem;
    requestId: number;
  } | null>(null);

  const {
    points: svPoints,
    geojson: svGeojson,
    error: svPointsError,
  } = useStreetViewPoints(API_BASE);

  // FIX #2a: bật click marker ở cả chế độ mặc định và info để click map xem thông tin.
  const { clickInfo, clear: clearClick } = useClickMarker(
    mapInstance,
    activePanel === "contribute" ||
    isRecordingPoleLocation ||
    activePanel === null ||
    activePanel === "info"
  );

  const {
    data: pointInfo,
    loading: pointInfoLoading,
    error: pointInfoError,
  } = useClickPointInfo(API_BASE, clickInfo);

  // FIX #2b: chỉ auto-mở info panel khi KHÔNG ở contribute / recording.
  useEffect(() => {
    if (!clickInfo) return;
    if (isRecordingPoleLocation) return;
    if (activePanel === "contribute") return;
    setActivePanel("info");
  }, [clickInfo, isRecordingPoleLocation, activePanel]);

  useEffect(() => {
    if (activePanel !== "info") {
      clearClick();
      setSelectedPoi(null);
    }
  }, [activePanel, clearClick]);

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

  useEffect(() => {
    let active = true;
    fetchElectricPoles()
      .then((poles) => {
        if (active) setElectricPoles(poles);
      })
      .catch((error: unknown) => {
        if (active) console.error("[electric-poles] fetch error:", error);
      });
    return () => {
      active = false;
    };
  }, [electricPolesVersion]);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    searchAbortController.current?.abort();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    searchAbortController.current = controller;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const results = await searchMap(trimmedQuery, controller.signal);
      if (!controller.signal.aborted) setSearchResults(results);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSearchError(
        error instanceof Error ? error.message : "Không thể tìm kiếm"
      );
      setSearchResults([]);
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePanel !== "search") {
      searchAbortController.current?.abort();
      searchAbortController.current = null;
    }
  }, [activePanel]);

  useEffect(() => () => searchAbortController.current?.abort(), []);

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
    []
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
    []
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

  const handleSearchResultClick = (_result: SearchResult) => {
    if (mapType !== "esri") {
      setSearchError(
        "Điều hướng kết quả tìm kiếm hiện chỉ hỗ trợ bản đồ Esri Satellite."
      );
    }
  };

  // FIX #4: contribute xong đóng panel thay vì no-op.
  const handleContributeCreated = useCallback(() => {
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
    [svPoints, mapInstance]
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
    [handleOpenStreetViewById, mapInstance]
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
    [clickInfo, mapInstance]
  );

  // FIX #5: adapter an toàn — GeneralPanel có thể truyền PoiInfo hoặc id.
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
    [handleOpenStreetViewById, mapInstance]
  );

  const handleCloseLocationDetails = useCallback(() => {
    clearClick();
    setSelectedPoi(null);
    handlePanelClose();
  }, [clearClick, handlePanelClose]);

  // FIX #1: sidebar phải render cả khi activePanel === "info".
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
          {activePanel === "layers" && (
            <LayersPanel
              layers={layers}
              onToggle={toggleLayer}
              onClose={handlePanelClose}
            />
          )}

          {activePanel === "settings" && (
            <SettingsPanel
              onClose={handlePanelClose}
              mapType={mapType}
              onMapTypeChange={setMapType}
              showMapSwitcher={SHOW_SWITCHER}
            />
          )}

          {activePanel === "search" && (
            <SearchPanel
              onClose={handlePanelClose}
              results={searchResults}
              loading={searchLoading}
              error={searchError}
              onSearch={handleSearch}
              onResultClick={handleSearchResultClick}
            />
          )}

          {activePanel === "contribute" && (
            <ContributePanel
              onClose={handlePanelClose}
              mapInstance={mapInstance}          // ← thêm dòng này
              onCreated={handleContributeCreated}
            />
          )}

          {activePanel === "poleManagement" && (
            <PoleManagementPanel
              onClose={handlePanelClose}
              onChanged={() => setElectricPolesVersion((v) => v + 1)}
              isRecordingLocation={isRecordingPoleLocation}
              onStartLocationRecording={handleStartPoleLocationRecording}
              onStopLocationRecording={handleStopPoleLocationRecording}
              onGoToPole={handleGoToPole}
            />
          )}

          {activePanel === "streetviewManagement" && (
            <StreetViewManagementPanel
              onClose={handlePanelClose}
              onChanged={() => setStreetViewVersion((v) => v + 1)}
              isRecordingLocation={isRecordingPoleLocation}
              onStartLocationRecording={handleStartPoleLocationRecording}
              onStopLocationRecording={handleStopPoleLocationRecording}
              onGoToImage={handleGoToStreetViewImage}
            />
          )}

          {activePanel === "poiManagement" && (
            <PoiManagementPanel
              onClose={handlePanelClose}
              onChanged={() => setPoisVersion((v) => v + 1)}
              isRecordingLocation={isRecordingPoleLocation}
              onStartLocationRecording={handleStartPoleLocationRecording}
              onStopLocationRecording={handleStopPoleLocationRecording}
              onGoToPoi={handleGoToPoi}
            />
          )}

          {activePanel === "electric" && (
            <ElectricPanel
              pole={electricPoles.find((p) => p.id === selectedPoleId) ?? null}
              onClose={handlePanelClose}
              onGoToPole={handleGoToPole}
            />
          )}

          {showLocationSidebar && activePoi && (
            <PlaceDetailSidebar
              place={activePoi}
              apiBase={API_BASE}
              onBack={() => setSelectedPoi(null)}
              onClose={handleCloseLocationDetails}
              onOpenStreetView={handleOpenStreetViewById}
            />
          )}

          {showLocationSidebar && !activePoi && (
            <GeneralPanel
              info={clickInfo}
              onClose={handleCloseLocationDetails}
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
              onPoiStreetView={handlePoiStreetView}
            />
          )}
        </aside>
      )}

      {/* PANEL 3: MAP VIEW */}
      <main className="app-map-panel">
        <ErrorBoundary
          key={`${mapType}-${mapKey}`}
          onReset={() => setMapKey((k) => k + 1)}
        >
          {mapType === "esri" && (
            <div
              className={`map-wrapper${showLocationSidebar ? " has-sidebar" : ""}`}
            >
              <EsriSatelliteMap
                electricPoles={electricPoles}
                onElectricPoleSelect={handleElectricPoleSelect}
                isRecordingPoleLocation={isRecordingPoleLocation}
                onPoleLocationRecorded={handlePoleLocationRecorded}
                layers={layers}
                onMapInstanceReady={handleMapInstanceReady}
                streetViewGeojson={svGeojson}
                onStreetViewIconClick={handleStreetViewIconClick}
              />
            </div>
          )}

          {mapType === "selfhost" && <SatelliteMap />}
          {mapType === "osm" && <OsmPolygonMap />}
          {mapType === "test" && <TestPSV />}
        </ErrorBoundary>

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
            document.body
          )}
      </main>
    </div>
  );
}