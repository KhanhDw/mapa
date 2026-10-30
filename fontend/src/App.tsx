import { useState } from "react";
import EsriSatelliteMap from "./components/maps/EsriSatelliteMap/EsriSatelliteMap";
import SatelliteMap from "./components/maps/SatelliteMap/SatelliteMap";
import OsmPolygonMap from "./components/maps/OsmPolygonMap/OsmPolygonMap";
import TestPSV from "./components/dev/TestPSV";
import "./App.css";

type MapType = "esri" | "selfhost" | "osm" | "test";

const SHOW_SWITCHER = import.meta.env.VITE_SHOW_MAP_SWITCHER === "true";


export default function App() {
  const [mapType, setMapType] = useState<MapType>("esri");

  // ===== PRODUCTION: chỉ EsriSatelliteMap =====
  if (!SHOW_SWITCHER) {
    return (
      <div className="app">
        <div className="map-view">
          <EsriSatelliteMap />
        </div>
      </div>
    );
  }

  // ===== DEVELOPMENT: 4 chế độ =====
  return (
    <div className="app">
      <div className="map-switcher" role="group" aria-label="Chọn bản đồ">
        <button
          type="button"
          className={mapType === "selfhost" ? "active" : ""}
          aria-pressed={mapType === "selfhost"}
          onClick={() => setMapType("selfhost")}
        >
          Vệ tinh nội bộ
        </button>
        <button
          type="button"
          className={mapType === "esri" ? "active" : ""}
          aria-pressed={mapType === "esri"}
          onClick={() => setMapType("esri")}
        >
          Esri Satellite
        </button>
        <button
          type="button"
          className={mapType === "osm" ? "active" : ""}
          aria-pressed={mapType === "osm"}
          onClick={() => setMapType("osm")}
        >
          OSM Polygon
        </button>
        <button
          type="button"
          className={mapType === "test" ? "active" : ""}
          aria-pressed={mapType === "test"}
          onClick={() => setMapType("test")}
        >
          Test PSV
        </button>
      </div>

      <div className="map-view">
        {mapType === "selfhost" && <SatelliteMap />}
        {mapType === "esri" && <EsriSatelliteMap />}
        {mapType === "osm" && <OsmPolygonMap />}
        {mapType === "test" && <TestPSV />}
      </div>
    </div>
  );
}