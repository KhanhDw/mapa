import { useState } from "react";
import EsriSatelliteMap from "./components/EsriSatelliteMap";
import SatelliteMap from "./components/SatelliteMap";
import OsmPolygonMap from "./components/OsmPolygonMap";
import "./App.css";
import TestPSV from "./components/TestPSV";

type MapType = "esri" | "selfhost" |"osm" | "test";

export default function App() {
  const [mapType, setMapType] = useState<MapType>("esri");

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