import {
    Popup,
    type MapLayerMouseEvent,
    type Map as MapLibreMap,
} from "maplibre-gl";

import type { MapGeoJSONFeature } from "maplibre-gl";

export interface SelectedMapPoi {
  id: string | number;
  name: string;
  category: string;
  address?: string;
  sourceType: "osm" | "user";
  lngLat: { lng: number; lat: number };
  properties: Record<string, unknown>;
}

export interface BindPoiInteractionsOptions {
  map: MapLibreMap;
  onPoiSelect?: (poi: SelectedMapPoi) => void;
  isInteractionBlocked?: () => boolean;
}

const POI_TARGETS = [
  {
    layerId: "lay-pois",
    sourceId: "src-pois",
    sourceLayer: "pois",
    sourceType: "osm" as const,
    subtitle: "Điểm quan tâm (OSM)",
    subtitleColor: "#1e3a8a",
  },
  {
    layerId: "lay-user-pois",
    sourceId: "src-user-pois",
    sourceLayer: "user_pois",
    sourceType: "user" as const,
    subtitle: "Địa điểm do người dùng đóng góp",
    subtitleColor: "#92400e",
  },
];

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

function isMapLibreMap(
  input: MapLibreMap | BindPoiInteractionsOptions,
): input is MapLibreMap {
  return typeof (input as MapLibreMap).on === "function" && !("map" in input);
}

export function bindPoiInteractions(
  input: MapLibreMap | BindPoiInteractionsOptions,
): () => void {
  const options: BindPoiInteractionsOptions = isMapLibreMap(input)
    ? { map: input }
    : input;

  const { map, onPoiSelect, isInteractionBlocked } = options;

  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    offset: [0, -18],
    maxWidth: "260px",
    className: "poi-hover-popup",
  });

  let hovered: {
    sourceId: string;
    sourceLayer: string;
    id: string | number;
  } | null = null;

  const setHoverState = (
    target: { sourceId: string; sourceLayer: string },
    id: string | number,
    hover: boolean,
  ) => {
    try {
      map.setFeatureState(
        { source: target.sourceId, sourceLayer: target.sourceLayer, id },
        { hover },
      );
    } catch {
      // Bỏ qua nếu feature không có id hợp lệ trong MVT
    }
  };

  const clearHover = () => {
    if (hovered) {
      setHoverState(hovered, hovered.id, false);
      hovered = null;
    }
    map.getCanvas().style.cursor = "";
    popup.remove();
  };

  const cleanups: Array<() => void> = [];

  for (const target of POI_TARGETS) {
    if (!map.getLayer(target.layerId)) continue;

    const onMouseMove = (e: MapLayerMouseEvent) => {
      if (isInteractionBlocked?.()) {
        clearHover();
        return;
      }

      const f = e.features?.[0];

      if (!f || f.geometry.type !== "Point") {
        clearHover();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const p = (f.properties ?? {}) as Record<string, unknown>;
      const rawId = f.id ?? p.id ?? p.osm_id;

      if (rawId !== undefined && rawId !== null && rawId !== "") {
        const featureId = rawId as string | number;

        const isSameFeature =
          hovered?.id === featureId && hovered?.sourceId === target.sourceId;

        if (!isSameFeature) {
          if (hovered) {
            setHoverState(hovered, hovered.id, false);
          }

          hovered = {
            sourceId: target.sourceId,
            sourceLayer: target.sourceLayer,
            id: featureId,
          };

          setHoverState(target, featureId, true);
        }
      }

      const poiName = esc(p.name || "Chưa đặt tên");

      const html = `
        <div class="poi-hover-content">
            <strong class="poi-hover-name">${poiName}</strong>
            <div style="
                font-size: 12px;
                color: ${target.subtitleColor};
            ">
                ${esc(target.subtitle)}
            </div>
            ${
              p.address
                ? `<div style="font-size:12px">${esc(p.address)}</div>`
                : ""
            }
        </div>
    `;

      popup.setLngLat(f.geometry.coordinates as [number, number]).setHTML(html);

      if (!popup.isOpen()) {
        popup.addTo(map);
      }
    };

    const onMouseLeave = () => {
      clearHover();
    };

    const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== "Point") return;

    e.originalEvent.stopPropagation();

    const p = f.properties ?? {};
    const rawId = f.id ?? p.id ?? p.osm_id;

    if (rawId === undefined || rawId === null) return;

    const poi: SelectedMapPoi = {
        id: rawId as string | number,
        name: String(p.name ?? "Unnamed POI"),
        category: String(p.category ?? p.amenity ?? "unknown"),
        address: p.address ? String(p.address) : undefined,
        sourceType: target.sourceType,
        lngLat: {
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
        },
        properties: p,
    };

    onPoiSelect?.(poi);
};

    map.on("mousemove", target.layerId, onMouseMove);
    map.on("mouseleave", target.layerId, onMouseLeave);
    map.on("click", target.layerId, onClick);

    cleanups.push(() => {
      map.off("mousemove", target.layerId, onMouseMove);
      map.off("mouseleave", target.layerId, onMouseLeave);
      map.off("click", target.layerId, onClick);
    });
  }

  return () => {
    clearHover();
    cleanups.forEach((fn) => fn());
  };
}

const POI_LAYER_IDS = ["lay-pois", "lay-user-pois"];

export function hasPoiAtPoint(
  map: MapLibreMap,
  point: { x: number; y: number },
): boolean {
  const existingLayers = POI_LAYER_IDS.filter((id) =>
    Boolean(map.getLayer(id)),
  );

  if (existingLayers.length === 0) return false;

  const features = map.queryRenderedFeatures([point.x, point.y], {
    layers: existingLayers,
  });

  return features.some((feature) => POI_LAYER_IDS.includes(feature.layer.id));
}

export interface NearbyPoiResult {
  feature: MapGeoJSONFeature;
  distance: number;
}

function getDistanceInMeters(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function findNearbyPoi(
  map: MapLibreMap,
  lngLat: { lng: number; lat: number },
  radiusMeters = 5,
): NearbyPoiResult | null {
  const existingLayers = POI_LAYER_IDS.filter((id) =>
    Boolean(map.getLayer(id)),
  );

  if (existingLayers.length === 0) return null;

  // Chuyển bán kính mét thành bán kính pixel tại vị trí click
  const center = map.project([lngLat.lng, lngLat.lat]);
  const nearbyPoint = map.unproject([center.x + 10, center.y]);

  const metersPerPixel =
    getDistanceInMeters(lngLat, {
      lng: nearbyPoint.lng,
      lat: nearbyPoint.lat,
    }) / 10;

  const radiusPixels = radiusMeters / metersPerPixel;

  const features = map.queryRenderedFeatures(
    [
      [center.x - radiusPixels, center.y - radiusPixels],
      [center.x + radiusPixels, center.y + radiusPixels],
    ],
    { layers: existingLayers },
  );

  let nearest: NearbyPoiResult | null = null;

  for (const feature of features) {
    if (feature.geometry.type !== "Point") continue;

    const coordinates = feature.geometry.coordinates;

    const distance = getDistanceInMeters(lngLat, {
      lng: coordinates[0],
      lat: coordinates[1],
    });

    if (distance <= radiusMeters && (!nearest || distance < nearest.distance)) {
      nearest = {
        feature,
        distance,
      };
    }
  }

  return nearest;
}
