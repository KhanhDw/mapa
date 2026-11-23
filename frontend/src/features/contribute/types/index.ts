
export interface PoiDraft {
    lng: number | null;
    lat: number | null;
    name: string;
    category: string;
    address: string;
    phone: string;
    description: string;
    photos: File[];
}

export const EMPTY: PoiDraft = {
    lng: null,
    lat: null,
    name: "",
    category: "cafe",
    address: "",
    phone: "",
    description: "",
    photos: [],
};

export interface CreatePoiResult {
    id: number;
    name: string;
    lng: number;
    lat: number;
}