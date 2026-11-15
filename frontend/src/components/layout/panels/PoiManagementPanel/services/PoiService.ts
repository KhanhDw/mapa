// services/PoiService.ts

import type { PoiItem } from "../../../../../api/pois";
import { poiRepository } from "../../../../../api/repositories/PoiRepository";

interface PoiQuery {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
}

export class PoiService {
    private static instance: PoiService;

    private constructor() {}

    public static getInstance(): PoiService {
        if (!PoiService.instance) {
            PoiService.instance = new PoiService();
        }

        return PoiService.instance;
    }

    public getUserPois(params: PoiQuery) {
        return poiRepository.getUserPois(params);
    }

    public getSystemPois(params: PoiQuery) {
        return poiRepository.getSystemPois(params);
    }

    public updatePoi(
        id: number | string,
        input: Partial<PoiItem>
    ) {
        return poiRepository.update(id, input);
    }

    public deletePoi(id: number | string) {
        return poiRepository.delete(id);
    }
}

export const poiService = PoiService.getInstance();