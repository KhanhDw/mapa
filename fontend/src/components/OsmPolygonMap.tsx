import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./OsmPolygonMap.css";
import { getMapLibreWorkerUrl, OSM_TILE_URLS, TILE_BASE } from "../config";

const POLYGON_LAYERS = [
    {
        id: "admin",
        table: "clean.admin_areas",
        label: "Ranh giới hành chính",
        color: "#d32f2f",
        opacity: 0.08,
        outline: "#c2185b",
    },
    {
        id: "water",
        table: "clean.water_areas",
        label: "Sông hồ, ao",
        color: "#64b5f6",
        opacity: 0.55,
        outline: "#1976d2",
    },
    {
        id: "landuse",
        table: "clean.landuse",
        label: "Sử dụng đất",
        color: "#81c784",
        opacity: 0.4,
        outline: "#388e3c",
    },
    {
        id: "buildings",
        table: "clean.buildings",
        label: "Tòa nhà",
        color: "#9e9e9e",
        opacity: 0.75,
        outline: "#616161",
        minzoom: 14,
    },
] as const;

function OsmPolygonMap() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        setWorkerUrl(
            getMapLibreWorkerUrl(getVersion()),
        );

        const map = new maplibregl.Map({
            container: containerRef.current,
            center: [105.85, 21.03],
            zoom: 6,
            minZoom: 3,
            maxZoom: 18,
            maxBounds: [
                [98, 3],
                [122, 27],
            ],
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: "raster",
                        tiles: OSM_TILE_URLS,
                        tileSize: 256,
                        maxzoom: 19,
                        attribution: "© OpenStreetMap contributors",
                    },
                },
                layers: [
                    {
                        id: "osm-base",
                        type: "raster",
                        source: "osm",
                    },
                ],
            },
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.addControl(
            new maplibregl.ScaleControl({
                maxWidth: 120,
                unit: "metric",
            }),
            "bottom-left",
        );

        map.on("load", () => {
            for (const polygon of POLYGON_LAYERS) {
                const sourceId = `source-${polygon.id}`;

                map.addSource(sourceId, {
                    type: "vector",
                    tiles: [
                        `${TILE_BASE}/${polygon.table}/{z}/{x}/{y}.pbf`,
                    ],
                    minzoom: 0,
                    maxzoom: 18,
                });

                map.addLayer({
                    id: polygon.id,
                    type: "fill",
                    source: sourceId,
                    "source-layer": polygon.table,
                    ...("minzoom" in polygon && polygon.minzoom
                        ? { minzoom: polygon.minzoom }
                        : {}),
                    paint: {
                        "fill-color": polygon.color,
                        "fill-opacity": polygon.opacity,
                        "fill-outline-color": polygon.outline,
                    },
                });
            }
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return (
        <div className="osm-polygon-map">
            <div
                ref={containerRef}
                className="osm-polygon-map__canvas"
                aria-label="Bản đồ OSM với lớp polygon"
            />
        </div>
    );
}

export default OsmPolygonMap;