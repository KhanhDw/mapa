// api/repositories/PoiRepository.ts

import type { PoiItem, PoiListResponse } from "../../components/layout/panels/PoiManagementPanel/types/poi";
import { apiClient } from "../http/ApiClient";

const USER_BASE = "/api/user-pois";
const SYSTEM_BASE = "/api/system-pois";

interface PoiQuery {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
}

export class PoiRepository {
    private static instance: PoiRepository;

    private constructor() {}

    public static getInstance(): PoiRepository {
        if (!PoiRepository.instance) {
            PoiRepository.instance = new PoiRepository();
        }

        return PoiRepository.instance;
    }

    private buildQuery(params: PoiQuery): string {
        const query = new URLSearchParams();

        if (params.search) query.set("search", params.search);
        if (params.category) query.set("category", params.category);

        if (params.limit != null) {
            query.set("limit", String(params.limit));
        }

        if (params.offset != null) {
            query.set("offset", String(params.offset));
        }

        return query.toString();
    }

    public async getUserPois(
        params: PoiQuery
    ): Promise<PoiListResponse> {
        const query = this.buildQuery(params);

        const result = await apiClient.request<PoiListResponse>(
            `${USER_BASE}?${query}`
        );

        return {
            ...result,
            items: result.items.map(item => ({
                ...item,
                source: "user",
            })),
        };
    }

    public async getSystemPois(
        params: PoiQuery
    ): Promise<PoiListResponse> {
        const query = this.buildQuery(params);

        const result = await apiClient.request<PoiListResponse>(
            `${SYSTEM_BASE}?${query}`
        );

        return {
            ...result,
            items: result.items.map(item => ({
                ...item,
                source: "system",
            })),
        };
    }

    public async update(
    id: number | string,
    input: Partial<PoiItem>
): Promise<PoiItem> {
    const result = await apiClient.request<PoiItem>(
        `${USER_BASE}/${encodeURIComponent(String(id))}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        }
    );

    return {
        ...result,
        source: "user",
    };
}

public async delete(
    id: number | string
): Promise<void> {
    await apiClient.request<void>(
        `${USER_BASE}/${encodeURIComponent(String(id))}`,
        {
            method: "DELETE",
        }
    );
}
}

export const poiRepository = PoiRepository.getInstance();