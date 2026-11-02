import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityBar,
  type PanelType,
  type MapType,
} from "./components/layout/Activitybar";
import {
  SearchPanel,
  ElectricPanel,
  type SearchResult,
} from "./components/layout/panels";
import { PoleManagementPanel } from "./components/layout/panels/ElectricPanel/PoleManagementPanel";
import { fetchElectricPoles } from "./api/electricPoles";
import type { ElectricPole } from "./api/electricPoles";
import { ErrorBoundary } from "./components/ErrorBoundary";
import EsriSatelliteMap from "./components/maps/EsriSatelliteMap/EsriSatelliteMap";
import SatelliteMap from "./components/maps/SatelliteMap/SatelliteMap";
import OsmPolygonMap from "./components/maps/OsmPolygonMap/OsmPolygonMap";
import TestPSV from "./components/dev/TestPSV";
import "./App.css";

const SHOW_SWITCHER = import.meta.env.VITE_SHOW_MAP_SWITCHER === "true";

export default function App() {
  const [mapType, setMapType] = useState<MapType>("esri");
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [electricPoles, setElectricPoles] = useState<ElectricPole[]>([]);
  const [electricPolesVersion, setElectricPolesVersion] = useState(0);
  const [selectedPoleId, setSelectedPoleId] = useState<number | null>(null);
  const [isRecordingPoleLocation, setIsRecordingPoleLocation] = useState(false);
  const poleLocationRecordedHandler = useRef<
    ((location: { lng: number; lat: number }) => void) | null
  >(null);
  const [poleNavigationRequest, setPoleNavigationRequest] = useState<{
    pole: ElectricPole;
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

  const handlePanelToggle = (panel: PanelType) => {
    const next = activePanel === panel ? null : panel;
    if (activePanel === "electric" || panel === "electric") {
      setSelectedPoleId(null);
    }
    if (panel === "poleManagement") {
      poleLocationRecordedHandler.current = null;
      setIsRecordingPoleLocation(false);
    }
    if (activePanel === "poleManagement") {
      poleLocationRecordedHandler.current = null;
      setIsRecordingPoleLocation(false);
    }
    setActivePanel(next);
  };

  const handleElectricPoleSelect = useCallback((pole: ElectricPole) => {
    setSelectedPoleId(pole.id);
    setActivePanel("electric");
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

  const closePoleManagement = () => {
    setActivePanel(null);
    poleLocationRecordedHandler.current = null;
    setIsRecordingPoleLocation(false);
  };

  const handleSearch = async (q: string) => {
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      // TODO: gọi API tìm kiếm thật
      // const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      // if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // setSearchResults(await res.json());
      setSearchResults([]); // tạm thời — thay bằng data thật
    } catch (err) {
      setSearchError((err as Error).message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <ActivityBar
        activePanel={activePanel}
        onPanelToggle={handlePanelToggle}
        mapType={mapType}
        onMapTypeChange={setMapType}
        showMapSwitcher={SHOW_SWITCHER}
      />
      <div className="app-content" style={{ position: "relative" }}>
        <ErrorBoundary
          key={`${mapType}-${mapKey}`}
          onReset={() => setMapKey((k) => k + 1)}
        >
          {mapType === "esri" && (
            <EsriSatelliteMap
              activePanel={activePanel}
              onAutoShowInfo={() => setActivePanel("info")}
              onPanelClose={() => setActivePanel(null)}
              electricPoles={electricPoles}
              onElectricPoleSelect={handleElectricPoleSelect}
              isRecordingPoleLocation={isRecordingPoleLocation}
              onPoleLocationRecorded={handlePoleLocationRecorded}
              poleNavigationRequest={poleNavigationRequest}
            />
          )}
          {mapType === "selfhost" && <SatelliteMap />}
          {mapType === "osm" && <OsmPolygonMap />}
          {mapType === "test" && <TestPSV />}
        </ErrorBoundary>

        {/* ── Panel mới — render tại App level, hoạt động với mọi map ── */}
        {activePanel === "search" && (
          <SearchPanel
            onClose={() => setActivePanel(null)}
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            onSearch={handleSearch}
            onResultClick={(r) => {
              // TODO: cần một cách điều khiển map (flyTo / chọn marker)
              // Ví dụ sau này: mapRef.current?.flyTo([r.lng, r.lat], 17)
              console.log("Search result clicked:", r);
            }}
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

        {activePanel === "poleManagement" && (
          <PoleManagementPanel
            onClose={closePoleManagement}
            onChanged={() => setElectricPolesVersion((version) => version + 1)}
            isRecordingLocation={isRecordingPoleLocation}
            onStartLocationRecording={handleStartPoleLocationRecording}
            onStopLocationRecording={handleStopPoleLocationRecording}
          />
        )}
      </div>
    </div>
  );
}