import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./EsriSatelliteMap.css";

import { addExtraLayers } from "./layers/addExtraLayers";
import { bindUserPoiHover } from "./layers/bindUserPoiHover";
import { ESRI_INITIAL_VIEW } from "./constants";

import { addRoadsLayer } from "./layers/roadsLayer";
import {
    ensureStreetViewLayer,
    setStreetViewData,
} from "./layers/streetViewLayer";
import {
    addElectricPoleLayer,
    ELECTRIC_POLE_LAYER_ID,
    setElectricPoleData,
} from "./layers/electricPoleLayer";
import type { ElectricPole } from "../../../api/electricPoles";
import type { LayerVisibility } from "../../layout/panels";
import { applyLayerVisibility } from "./layers/applyLayerVisibility";

import { useEffect, useRef, useState } from "react";
import {
    ESRI_SATELLITE_TILE_URL,
    getMapLibreWorkerUrl,
} from "../../../config";


import type { StreetViewGeoJSON } from "./hooks/useStreetViewPoints";
interface Props {
    electricPoles: ElectricPole[];
    onElectricPoleSelect: (pole: ElectricPole) => void;
    isRecordingPoleLocation: boolean;
    onPoleLocationRecorded: (location: { lng: number; lat: number }) => void;
    layers: LayerVisibility;
    onMapInstanceReady?: (map: MapLibreMap) => void;
    streetViewGeojson?: StreetViewGeoJSON | null;
    onStreetViewIconClick?: (id: number) => void;
}

function EsriSatelliteMap({
    electricPoles,
    onElectricPoleSelect,
    isRecordingPoleLocation,
    onPoleLocationRecorded,
    layers,
    onMapInstanceReady,
    streetViewGeojson,
    onStreetViewIconClick,
}: Props) {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
    // Ref giữ callback ổn định để dùng trong map load (tránh closure cũ)
    const onStreetViewIconClickRef = useRef(onStreetViewIconClick);
    useEffect(() => {
        onStreetViewIconClickRef.current = onStreetViewIconClick;
    }, [onStreetViewIconClick]);

    // Đồng bộ Layer Visibility
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        applyLayerVisibility(mapRef.current, layers);
    }, [mapReady, layers]);

    // Init map (chỉ 1 lần)
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        maplibregl.setWorkerUrl(getMapLibreWorkerUrl(maplibregl.getVersion()));

        const map = new maplibregl.Map({
            container: mapContainer.current,
            ...ESRI_INITIAL_VIEW,
            style: {
                version: 8,
                sources: {
                    "satellite-esri": {
                        type: "raster",
                        tiles: [ESRI_SATELLITE_TILE_URL],
                        tileSize: 256,
                        maxzoom: 19,
                        attribution: "Tiles © Esri",
                    },
                },
                layers: [
                    {
                        id: "satellite-layer",
                        type: "raster",
                        source: "satellite-esri",
                        minzoom: 0,
                        maxzoom: 22,
                    },
                ],
            },
            transformRequest: (url) => {
                if (url.startsWith("/")) {
                    return {
                        url: new URL(url, window.location.origin).href,
                    };
                }
                return { url };
            },
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.addControl(
            new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
            "bottom-left"
        );

        map.on("error", (e) => console.error("[maplibre]", e.error));

        map.on("load", () => {
            addRoadsLayer(map);
            addExtraLayers(map);
            bindUserPoiHover(map);
            ensureStreetViewLayer({
                map,
                onIconClick: (id) =>
                    onStreetViewIconClickRef.current?.(id),
            });
            addElectricPoleLayer(map);
            mapRef.current = map;
            setMapInstance(map);
            onMapInstanceReady?.(map);
            setMapReady(true);
        });

        return () => {
            map.remove();
            mapRef.current = null;
            setMapInstance(null);
            setMapReady(false);
        };
    }, [onMapInstanceReady]);

    // Update electric poles
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        setElectricPoleData(mapRef.current, electricPoles);
    }, [mapReady, electricPoles]);

    // Click vào pole để chọn
    useEffect(() => {
        const map = mapInstance;
        if (!map || !map.getLayer(ELECTRIC_POLE_LAYER_ID)) return;

        const onPoleClick = (event: maplibregl.MapLayerMouseEvent) => {
            if (isRecordingPoleLocation) return;
            const poleId = Number(event.features?.[0]?.properties?.poleId);
            const pole = electricPoles.find((item) => item.id === poleId);
            if (pole) onElectricPoleSelect(pole);
        };
        const setPointerCursor = () => {
            map.getCanvas().style.cursor = "pointer";
        };
        const clearPointerCursor = () => {
            map.getCanvas().style.cursor = "";
        };

        map.on("click", ELECTRIC_POLE_LAYER_ID, onPoleClick);
        map.on("mouseenter", ELECTRIC_POLE_LAYER_ID, setPointerCursor);
        map.on("mouseleave", ELECTRIC_POLE_LAYER_ID, clearPointerCursor);
        return () => {
            map.off("click", ELECTRIC_POLE_LAYER_ID, onPoleClick);
            map.off("mouseenter", ELECTRIC_POLE_LAYER_ID, setPointerCursor);
            map.off("mouseleave", ELECTRIC_POLE_LAYER_ID, clearPointerCursor);
        };
    }, [mapInstance, electricPoles, isRecordingPoleLocation, onElectricPoleSelect]);

    // Ghi vị trí pole trên map
    useEffect(() => {
        if (!mapInstance || !isRecordingPoleLocation) return;

        const handleMapClick = (event: maplibregl.MapMouseEvent) => {
            onPoleLocationRecorded({
                lng: event.lngLat.lng,
                lat: event.lngLat.lat,
            });
        };
        mapInstance.on("click", handleMapClick);
        return () => {
            mapInstance.off("click", handleMapClick);
        };
    }, [mapInstance, isRecordingPoleLocation, onPoleLocationRecorded]);

    // Update Street View data (geojson được fetch từ App)
    useEffect(() => {
        if (!mapReady || !mapRef.current || !streetViewGeojson) return;
        setStreetViewData(mapRef.current, streetViewGeojson);
    }, [mapReady, streetViewGeojson]);

    // Chỉ render map container – wrapper/sidebar do App quản lý
    return <div ref={mapContainer} className="map-container" />;
}

export default EsriSatelliteMap;