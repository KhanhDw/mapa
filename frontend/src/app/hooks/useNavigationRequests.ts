import { useCallback, useState } from "react";

import type { ElectricPole } from "../../features/electric-poles/api/electricPoles";
import type { PoiWithSource } from "../../features/poi/api/pois";
import type { SearchResult } from "../../features/search/api/search";
import type { StreetViewImage } from "../../features/streetview/api/streetview";

interface Request<T> {
    value: T;
    requestId: number;
}

type NavigablePoi = PoiWithSource | SearchResult;

const next = <T,>(
    prev: Request<T> | null,
    value: T
): Request<T> => ({
    value,
    requestId: (prev?.requestId ?? 0) + 1,
});

export function useNavigationRequests() {
    const [poleReq, setPoleReq] =
        useState<Request<ElectricPole> | null>(null);

    const [svReq, setSvReq] =
        useState<Request<StreetViewImage> | null>(null);

    const [poiReq, setPoiReq] =
        useState<Request<NavigablePoi> | null>(null);

    const requestPoleNavigation = useCallback(
        (pole: ElectricPole) => {
            setPoleReq((current) => next(current, pole));
        },
        []
    );

    const requestStreetViewNavigation = useCallback(
        (image: StreetViewImage) => {
            setSvReq((current) => next(current, image));
        },
        []
    );

    const requestPoiNavigation = useCallback(
        (poi: NavigablePoi) => {
            setPoiReq((current) => next(current, poi));
        },
        []
    );

    return {
        poleReq,
        svReq,
        poiReq,

        requestPoleNavigation,
        requestStreetViewNavigation,
        requestPoiNavigation,
    };
}

export type { NavigablePoi };

