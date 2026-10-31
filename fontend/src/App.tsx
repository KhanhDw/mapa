import { useState } from "react";
import {
  ActivityBar,
  type PanelType,
  type MapType,
} from "./components/layout/Activitybar";
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
  // ✅ Mỗi lần reset error → bump mapKey → ErrorBoundary + subtree remount sạch
  const [mapKey, setMapKey] = useState(0);

  const handlePanelToggle = (panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
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
      <div className="app-content">
        <ErrorBoundary
          key={`${mapType}-${mapKey}`}
          onReset={() => setMapKey((k) => k + 1)}
        >
          {mapType === "esri" && (
            <EsriSatelliteMap
              activePanel={activePanel}
              onAutoShowInfo={() => setActivePanel("info")}
              onPanelClose={() => setActivePanel(null)}
            />
          )}
          {mapType === "selfhost" && <SatelliteMap />}
          {mapType === "osm" && <OsmPolygonMap />}
          {mapType === "test" && <TestPSV />}
        </ErrorBoundary>
      </div>
    </div>
  );
}