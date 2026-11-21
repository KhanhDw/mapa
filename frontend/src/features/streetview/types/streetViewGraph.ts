export interface StreetViewGraphPoint {
    id: number;
    image_url: string;
    heading: number | null;
    next_ids: number[];
    link_positions: Array<{
        textureX: number;
        textureY: number;
    }>;
    lng: number;
    lat: number;
}