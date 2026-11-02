import { useCallback, useEffect, useState } from "react";
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
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const handleElectricPoleSelect = useCallback((pole: ElectricPole) => {
    setSelectedPoleId(pole.id);
    setActivePanel("electric");
  }, []);

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
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === "poleManagement" && (
          <PoleManagementPanel
            onClose={() => setActivePanel(null)}
            onChanged={() => setElectricPolesVersion((version) => version + 1)}
          />
        )}
      </div>
    </div>
  );
}