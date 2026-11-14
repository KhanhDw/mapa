import { useCallback, useState } from 'react';
import type { ElectricPole } from '../../api/electricPoles';
import type { PoiItem } from '../../api/pois';
import type { StreetViewImage } from '../../api/streetview';

interface Request<T> {
    value: T;
    requestId: number;
}

const next = <T,>(prev: Request<T> | null, value: T): Request<T> => ({
    value,
    requestId: (prev?.requestId ?? 0) + 1,
});

export function useNavigationRequests() {
    const [poleReq, setPoleReq] = useState<Request<ElectricPole> | null>(null);
    const [svReq, setSvReq] = useState<Request<StreetViewImage> | null>(null);
    const [poiReq, setPoiReq] = useState<Request<PoiItem> | null>(null);

    return {
        poleReq,
        svReq,
        poiReq,
        requestPoleNavigation: useCallback(
            (pole: ElectricPole) => setPoleReq((c) => next(c, pole)),
            [],
        ),
        requestStreetViewNavigation: useCallback(
            (image: StreetViewImage) => setSvReq((c) => next(c, image)),
            [],
        ),
        requestPoiNavigation: useCallback(
            (poi: PoiItem) => setPoiReq((c) => next(c, poi)),
            [],
        ),
    };
}