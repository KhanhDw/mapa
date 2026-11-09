import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { ElectricPole } from "../../../../api/electricPoles";

export const ELECTRIC_POLE_SOURCE_ID = "electric-poles";
export const ELECTRIC_POLE_LAYER_ID = "electric-poles-points";

function toFeatureCollection(poles: ElectricPole[]) {
    return {
        type: "FeatureCollection" as const,
        features: poles.map((pole) => ({
            type: "Feature" as const,
            geometry: {
                type: "Point" as const,
                coordinates: [pole.lng, pole.lat] as [number, number],
            },
            properties: { poleId: pole.id, status: pole.status },
        })),
    };
}

export function addElectricPoleLayer(map: MapLibreMap) {
    if (!map.getSource(ELECTRIC_POLE_SOURCE_ID)) {
        map.addSource(ELECTRIC_POLE_SOURCE_ID, {
            type: "geojson",
            data: toFeatureCollection([]),
        });
    }

    if (!map.getLayer(ELECTRIC_POLE_LAYER_ID)) {
        map.addLayer({
            id: ELECTRIC_POLE_LAYER_ID,
            type: "circle",
            source: ELECTRIC_POLE_SOURCE_ID,
            paint: {
                "circle-radius": 7,
                "circle-color": [
                    "match",
                    ["get", "status"],
                    "warning",
                    "#d97706",
                    "error",
                    "#dc2626",
                    "#16a34a",
                ],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
            },
        });
    }
}

export function setElectricPoleData(map: MapLibreMap, poles: ElectricPole[]) {
    const source = map.getSource(ELECTRIC_POLE_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(poles));
}
