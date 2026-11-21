import type {
    SystemPoiQuery,
    UpdateUserPoiInput,
    UserPoiQuery,
} from "../../../api/pois";

import {
    deleteUserPoi,
    fetchSystemPois,
    fetchUserPois,
    updateUserPoi,
} from "../../../api/pois";

export class PoiService {
    private static instance: PoiService;

    private constructor() {}

    public static getInstance(): PoiService {
        if (!PoiService.instance) {
            PoiService.instance = new PoiService();
        }

        return PoiService.instance;
    }

    public getUserPois(params: UserPoiQuery) {
        return fetchUserPois(params);
    }

    public getSystemPois(params: SystemPoiQuery) {
        return fetchSystemPois(params);
    }

    public updatePoi(
        id: number | string,
        input: UpdateUserPoiInput
    ) {
        return updateUserPoi(id, input);
    }

    public deletePoi(id: number | string) {
        return deleteUserPoi(id);
    }
}

export const poiService = PoiService.getInstance();