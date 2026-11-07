import { useCallback, useEffect, useRef, useState } from "react";
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
} from "./components/layout/panels";
import { PoleManagementPanel } from "./components/layout/panels/ElectricPanel/PoleManagementPanel";
import { StreetViewManagementPanel } from "./components/layout/panels/StreetViewManagementPanel";
import { fetchElectricPoles } from "./api/electricPoles";
import type { ElectricPole } from "./api/electricPoles";
import type { StreetViewImage } from "./api/streetview";
import { searchMap } from "./api/search";
import { ErrorBoundary } from "./components/ErrorBoundary";
import EsriSatelliteMap from "./components/maps/EsriSatelliteMap/EsriSatelliteMap";
import SatelliteMap from "./components/maps/SatelliteMap/SatelliteMap";
import OsmPolygonMap from "./components/maps/OsmPolygonMap/OsmPolygonMap";
import TestPSV from "./components/dev/TestPSV";
import "./App.css";

const SHOW_SWITCHER = import.meta.env.VITE_SHOW_MAP_SWITCHER === "true";

/** Các panel chạy ở chế độ chia đôi màn hình + dùng chế độ ghi vị trí trên map. */
const isManagementPanel = (panel: PanelType | null) =>
  panel === "poleManagement" || panel === "streetviewManagement";

export default function App() {
  const [mapType, setMapType] = useState<MapType>("esri");
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [electricPoles, setElectricPoles] = useState<ElectricPole[]>([]);
  const [electricPolesVersion, setElectricPolesVersion] = useState(0);
  const [selectedPoleId, setSelectedPoleId] = useState<number | null>(null);

  // Ghi vị trí trên map: dùng chung cho panel trụ điện và panel Street View
  // (chỉ một panel quản lý mở tại một thời điểm). Tên "Pole" giữ nguyên để
  // không phải đổi props của EsriSatelliteMap.
  const [isRecordingPoleLocation, setIsRecordingPoleLocation] = useState(false);
  const poleLocationRecordedHandler = useRef<
    ((location: { lng: number; lat: number }) => void) | null
  >(null);
  const [poleNavigationRequest, setPoleNavigationRequest] = useState<{
    pole: ElectricPole;
    requestId: number;
  } | null>(null);

  // ── Street View management ──────────────────────────────
  const [streetViewVersion, setStreetViewVersion] = useState(0);
  const [streetViewNavigationRequest, setStreetViewNavigationRequest] = useState<{
    image: StreetViewImage;
    requestId: number;
  } | null>(null);

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

  // ── State cho SearchPanel ───────────────────────────────
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

  useEffect(
    () => () => searchAbortController.current?.abort(),
    []
  );

  const handlePanelToggle = (panel: PanelType) => {
    const next = activePanel === panel ? null : panel;
    if (activePanel === "electric" || panel === "electric") {
      setSelectedPoleId(null);
    }
    // Vào / ra / chuyển giữa các panel quản lý -> luôn tắt chế độ ghi vị trí
    if (isManagementPanel(panel) || isManagementPanel(activePanel)) {
      poleLocationRecordedHandler.current = null;
      setIsRecordingPoleLocation(false);
    }
    setActivePanel(next);
  };

  // ── Chọn trụ từ marker map hoặc nearby_poles list ──────
  // Kèm fly-to để map bay tới trụ (nếu đang ở map esri)
  const handleElectricPoleSelect = useCallback((pole: ElectricPole) => {
    setSelectedPoleId(pole.id);
    setActivePanel("electric");
    setPoleNavigationRequest((current) => ({
      pole,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const handlePoleLocationRecorded = useCallback((location: { lng: number; lat: number }) => {
    poleLocationRecordedHandler.current?.(location);
    poleLocationRecordedHandler.current = null;
    setIsRecordingPoleLocation(false);
  }, []);

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

  const closeManagementPanel = () => {
    setActivePanel(null);
    poleLocationRecordedHandler.current = null;
    setIsRecordingPoleLocation(false);
  };

  // ── Stable callbacks cho EsriSatelliteMap ────────────────
  const handleAutoShowInfo = useCallback(() => {
    setActivePanel("info");
  }, []);

  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
  }, []);

  const isSplitMode = isManagementPanel(activePanel);

  return (
    <div className="app-layout">
      <ActivityBar
        activePanel={activePanel}
        onPanelToggle={handlePanelToggle}
      />

      <div className="app-content">
        {/* Cột trái: chỉ hiện khi ở chế độ split */}
        {isSplitMode && (
          <div className="app-content__split-pane">
            {activePanel === "poleManagement" && (
              <PoleManagementPanel
                onClose={closeManagementPanel}
                onChanged={() => setElectricPolesVersion((version) => version + 1)}
                isRecordingLocation={isRecordingPoleLocation}
                onStartLocationRecording={handleStartPoleLocationRecording}
                onStopLocationRecording={handleStopPoleLocationRecording}
                onGoToPole={handleGoToPole}
              />
            )}
            {activePanel === "streetviewManagement" && (
              <StreetViewManagementPanel
                onClose={closeManagementPanel}
                onChanged={() => setStreetViewVersion((version) => version + 1)}
                isRecordingLocation={isRecordingPoleLocation}
                onStartLocationRecording={handleStartPoleLocationRecording}
                onStopLocationRecording={handleStopPoleLocationRecording}
                onGoToImage={handleGoToStreetViewImage}
              />
            )}
          </div>
        )}

        {/* Cột phải: vùng map + các overlay panel */}
        <div className="app-content__map">
          <ErrorBoundary
            key={`${mapType}-${mapKey}`}
            onReset={() => setMapKey((k) => k + 1)}
          >
            {mapType === "esri" && (
              <EsriSatelliteMap
                activePanel={activePanel}
                onAutoShowInfo={handleAutoShowInfo}
                onPanelClose={handlePanelClose}
                electricPoles={electricPoles}
                onElectricPoleSelect={handleElectricPoleSelect}
                isRecordingPoleLocation={isRecordingPoleLocation}
                onPoleLocationRecorded={handlePoleLocationRecorded}
                poleNavigationRequest={poleNavigationRequest}
                streetViewVersion={streetViewVersion}
                streetViewNavigationRequest={streetViewNavigationRequest}
                searchResults={searchResults}
                searchLoading={searchLoading}
                searchError={searchError}
                onSearch={handleSearch}
                /* ▼ 3 props mới cho SettingsPanel bên trong EsriSatelliteMap */
                mapType={mapType}
                onMapTypeChange={setMapType}
                showMapSwitcher={SHOW_SWITCHER}
              />
            )}
            {mapType === "selfhost" && <SatelliteMap />}
            {mapType === "osm" && <OsmPolygonMap />}
            {mapType === "test" && <TestPSV />}
          </ErrorBoundary>

          {activePanel === "search" && mapType !== "esri" && (
            <SearchPanel
              onClose={handlePanelClose}
              results={searchResults}
              loading={searchLoading}
              error={searchError}
              onSearch={handleSearch}
              onResultClick={() => {
                setSearchError(
                  "Điều hướng kết quả tìm kiếm hiện chỉ hỗ trợ bản đồ Esri Satellite."
                );
              }}
            />
          )}

          {/* ▼ SettingsPanel cho các map KHÔNG phải esri.
              Với esri, SettingsPanel được render bên trong
              EsriSatelliteMap (vì map đó có logic riêng cho panel này). */}
          {activePanel === "settings" && mapType !== "esri" && (
            <SettingsPanel
              onClose={handlePanelClose}
              mapType={mapType}
              onMapTypeChange={setMapType}
              showMapSwitcher={SHOW_SWITCHER}
            />
          )}

          {activePanel === "electric" && (
            <ElectricPanel
              pole={electricPoles.find((pole) => pole.id === selectedPoleId) ?? null}
              onClose={() => {
                setSelectedPoleId(null);
                setActivePanel(null);
              }}
              onGoToPole={handleGoToPole}
            />
          )}
        </div>
      </div>
    </div>
  );
}