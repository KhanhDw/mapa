export type CoordFormat = "decimal" | "dms";
export type CopyTarget = "all" | "lat" | "lng" | "address";
export type CopyState = "idle" | "ok" | "fail";

export interface NearbyPole {
    id: number;
    pole_code: string;
    route: string;
    status: "good" | "warning" | "error";
    detail: string | null;
    lng: number;
    lat: number;
    distance_m: number;
}

export interface PoiInfo {
    source?: "osm" | "user";
    id: string | number;
    name: string | null;
    category: string | null;
    fclass?: string | null;
    photo_count?: number;
    distance_m: number;
    lng: number;
    lat: number;
    streetview_id?: number | null;
    streetview_distance_m?: number | null;
}

export interface ClickInfo {
    lng: number;
    lat: number;
    zoom: number;
}

export interface RoadInfo {
    osm_id: string | null;
    name: string | null;
    ref: string | null;
    fclass: string;
    oneway: string | null;
    maxspeed: number | null;
    distance_m: number;
}

export interface StreetViewHit {
    id: number;
    distance_m: number;
}

export interface Props {
    info: ClickInfo | null;
    onClose: () => void;
    road?: RoadInfo | null;
    streetview?: StreetViewHit | null;
    address?: string | null;
    pois?: PoiInfo[] | null;
    nearbyPoles?: NearbyPole[] | null;
    loading?: boolean;
    roadLoading?: boolean;
    streetviewLoading?: boolean;
    addressLoading?: boolean;
    poisLoading?: boolean;
    error?: string | null;
    onOpenStreetView?: (id: number) => void;
    onPoleClick?: (pole: NearbyPole) => void;
    onPoiClick?: (poi: PoiInfo) => void;
    onPoiDetails?: (poi: PoiInfo) => void;
    onPoiStreetView?: (streetviewId: number) => void;
}