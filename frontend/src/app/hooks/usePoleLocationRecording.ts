import { useCallback, useRef, useState } from 'react';

type Location = { lng: number; lat: number };
type Handler = (loc: Location) => void;

export function usePoleLocationRecording() {
    const [isRecording, setIsRecording] = useState(false);
    const handlerRef = useRef<Handler | null>(null);

    const start = useCallback((h: Handler) => {
        handlerRef.current = h;
        setIsRecording(true);
    }, []);

    const stop = useCallback(() => {
        handlerRef.current = null;
        setIsRecording(false);
    }, []);

    const record = useCallback((loc: Location) => {
        handlerRef.current?.(loc);
        handlerRef.current = null;
        setIsRecording(false);
    }, []);

    return { isRecording, start, stop, record };
}