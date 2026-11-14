import { ErrorBoundary } from "../ErrorBoundary";
import EsriSatelliteMap from "../maps/EsriSatelliteMap/EsriSatelliteMap";
import SatelliteMap from "../maps/SatelliteMap/SatelliteMap";
import OsmPolygonMap from "../maps/OsmPolygonMap/OsmPolygonMap";
import TestPSV from "../dev/TestPSV";
import type { MapType } from "./Activitybar";
import type { ElectricPole } from "../../api/electricPoles";
import type { LayerVisibility } from "./panels";
import type { Map as MapLibreMap } from "maplibre-gl";

interface MapContainerViewProps {
    mapType: MapType;
    mapKey: number;
    setMapKey: React.Dispatch<React.SetStateAction<number>>;
    showLocationSidebar: boolean;
    electricPoles: ElectricPole[];
    onElectricPoleSelect: (pole: ElectricPole) => void;
    isRecordingPoleLocation: boolean;
    onPoleLocationRecorded: (location: { lng: number; lat: number }) => void;
    layers: LayerVisibility;
    onMapInstanceReady: (map: MapLibreMap) => void;
    svGeojson: any;
    onStreetViewIconClick: (id: number) => void;
}

export function MapContainerView({
    mapType,
    mapKey,
    setMapKey,
    showLocationSidebar,
    electricPoles,
    onElectricPoleSelect,
    isRecordingPoleLocation,
    onPoleLocationRecorded,
    layers,
    onMapInstanceReady,
    svGeojson,
    onStreetViewIconClick,
}: MapContainerViewProps) {
    return (
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
                        onElectricPoleSelect={onElectricPoleSelect}
                        isRecordingPoleLocation={isRecordingPoleLocation}
                        onPoleLocationRecorded={onPoleLocationRecorded}
                        layers={layers}
                        onMapInstanceReady={onMapInstanceReady}
                        streetViewGeojson={svGeojson}
                        onStreetViewIconClick={onStreetViewIconClick}
                    />
                </div>
            )}

            {mapType === "selfhost" && <SatelliteMap />}
            {mapType === "osm" && <OsmPolygonMap />}
            {mapType === "test" && <TestPSV />}
        </ErrorBoundary>
    );
}