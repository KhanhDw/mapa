export interface LayerVisibility {
    roads: boolean;
    roadNames: boolean;
    streetview: boolean;
}

export type LayerKey = keyof LayerVisibility;

export const DEFAULT_LAYERS: LayerVisibility = {
    roads: true,
    roadNames: true,
    streetview: true,
};