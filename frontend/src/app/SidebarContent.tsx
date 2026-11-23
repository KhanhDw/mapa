import {
    LayersPanel,
    SettingsPanel,
    SearchPanel,
    ContributePanel,
    PoleManagementPanel,
    StreetViewManagementPanel,
    PoiManagementPanel,
    PoleDetailPanel,
    PlaceDetailSidebar,
    GeneralPanel,
} from "../components/layout/panels";

import type {
    LayerVisibility,
    LayerKey,
    PoiInfo,
} from "../components/layout/panels";

import type {
    PanelType,
    MapType,
} from "../components/layout/Activitybar/ActivityBar";

import type { ElectricPole } from "../features/electric-poles/api/electricPoles";
import type { StreetViewImage } from "../features/streetview/api/streetview";
import type { PoiWithSource } from "../features/poi/api/pois";
import type { SearchResult } from "../features/search/api/search";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ClickInfo }from '../features/poi-info/MapPointInfoPanel/types';
type NavigablePoi = PoiWithSource | SearchResult;

interface SidebarContentProps {
    isAuthenticated: boolean;
    activePanel: PanelType | null;
    mapType: MapType;
    setMapType: (type: MapType) => void;
    showMapSwitcher: boolean;
    layers: LayerVisibility;
    toggleLayer: (key: LayerKey) => void;
    onClose: () => void;
    searchResults: SearchResult[];
    searchLoading: boolean;
    searchError: string | null;
    onSearch: (q: string) => void;
    onSearchResultClick: (res: SearchResult) => void;
    mapInstance: MapLibreMap | null;
    onContributeCreated: () => void;
    refreshPoles: () => void;
    isRecordingPoleLocation: boolean;
    onStartLocationRecording: (cb: (loc: { lng: number; lat: number }) => void) => void;
    onStopLocationRecording: () => void;
    onGoToPole: (pole: ElectricPole) => void;
    onGoToImage: (img: StreetViewImage) => void;
    onGoToPoi: (poi: NavigablePoi) => void;
    setStreetViewVersion: React.Dispatch<React.SetStateAction<number>>;
    setPoisVersion: React.Dispatch<React.SetStateAction<number>>;
    electricPoles: ElectricPole[];
    selectedPoleId: number | null;
    showLocationSidebar: boolean;
    activePoi: PoiInfo | null;
    clickInfo: ClickInfo | null;
    pointInfo: any;
    pointInfoLoading: boolean;
    pointInfoError: any;
    apiBase: string;
    setSelectedPoi: (poi: any) => void;
    handleCloseLocationDetails: () => void;
    handleOpenStreetViewById: (id: number) => void;
    handlePoiClick: (poi: PoiInfo) => void;
    handlePoiDetails: (poi: PoiInfo) => void;
    handlePoiStreetView: (poiOrId: PoiInfo | number) => void;
}

export function SidebarContent({
    activePanel,
    isAuthenticated,
    mapType,
    setMapType,
    showMapSwitcher,
    layers,
    toggleLayer,
    onClose,
    searchResults,
    searchLoading,
    searchError,
    onSearch,
    onSearchResultClick,
    mapInstance,
    onContributeCreated,
    refreshPoles,
    isRecordingPoleLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    onGoToPole,
    onGoToImage,
    onGoToPoi,
    setStreetViewVersion,
    setPoisVersion,
    electricPoles,
    selectedPoleId,
    showLocationSidebar,
    activePoi,
    clickInfo,
    pointInfo,
    pointInfoLoading,
    pointInfoError,
    apiBase,
    setSelectedPoi,
    handleCloseLocationDetails,
    handleOpenStreetViewById,
    handlePoiClick,
    handlePoiDetails,
    handlePoiStreetView,
}: SidebarContentProps) {
    if (!activePanel) return null;

    const requiresAuthentication =
        activePanel === "electric" ||
        activePanel === "poleManagement" ||
        activePanel === "streetviewManagement" ||
        activePanel === "poiManagement" ||
        activePanel === "contribute" ||
        activePanel === "settings";

    if (requiresAuthentication && !isAuthenticated) {
        return null;
    }
    return (
        <>
            {activePanel === "layers" && (
                <LayersPanel layers={layers} onToggle={toggleLayer} onClose={onClose} />
            )}

            {activePanel === "settings" && (
                <SettingsPanel
                    onClose={onClose}
                    mapType={mapType}
                    onMapTypeChange={setMapType}
                    showMapSwitcher={showMapSwitcher}
                />
            )}

            {activePanel === "search" && (
                <SearchPanel
                    onClose={onClose}
                    results={searchResults}
                    loading={searchLoading}
                    error={searchError}
                    onSearch={onSearch}
                    onResultClick={onSearchResultClick}
                />
            )}

            {activePanel === "contribute" && (
                <ContributePanel
                    onClose={onClose}
                    mapInstance={mapInstance}
                    onCreated={onContributeCreated}
                />
            )}

            {activePanel === "poleManagement" && (
                <PoleManagementPanel
                    onClose={onClose}
                    onChanged={refreshPoles}
                    isRecordingLocation={isRecordingPoleLocation}
                    onStartLocationRecording={onStartLocationRecording}
                    onStopLocationRecording={onStopLocationRecording}
                    onGoToPole={onGoToPole}
                />
            )}

            {activePanel === "streetviewManagement" && (
                <StreetViewManagementPanel
                    onClose={onClose}
                    onChanged={() => setStreetViewVersion((v) => v + 1)}
                    isRecordingLocation={isRecordingPoleLocation}
                    onStartLocationRecording={onStartLocationRecording}
                    onStopLocationRecording={onStopLocationRecording}
                    onGoToImage={onGoToImage}
                />
            )}

            {activePanel === "poiManagement" && (
                <PoiManagementPanel
                    onClose={onClose}
                    onChanged={() => setPoisVersion((v) => v + 1)}
                    isRecordingLocation={isRecordingPoleLocation}
                    onStartLocationRecording={onStartLocationRecording}
                    onStopLocationRecording={onStopLocationRecording}
                    onGoToPoi={onGoToPoi}
                />
            )}

            {activePanel === "electric" && (
                <PoleDetailPanel
                    pole={electricPoles.find((p) => p.id === selectedPoleId) ?? null}
                    onClose={onClose}
                    onGoToPole={onGoToPole}
                />
            )}

            {showLocationSidebar && activePoi && (
                <PlaceDetailSidebar
                    place={activePoi}
                    apiBase={apiBase}
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
        </>
    );
}