import { useEffect, useRef, useState } from "react";
import type { CopyState, CopyTarget } from "../types";

const RESET_MS = 2000;

type Entry = { key: string; target: CopyTarget | null; value: CopyState };

export function useCopy(infoKey: string) {
    const [entry, setEntry] = useState<Entry>({ key: "", target: null, value: "idle" });
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copy = async (target: CopyTarget, text: string) => {
        window.clearTimeout(timer.current);
        try {
            await navigator.clipboard.writeText(text);
            setEntry({ key: infoKey, target, value: "ok" });
        } catch {
            setEntry({ key: infoKey, target, value: "fail" });
        }
        timer.current = window.setTimeout(() => {
            setEntry(prev => ({ ...prev, value: "idle" }));
        }, RESET_MS);
    };

    const getStatus = (target: CopyTarget): CopyState =>
        entry.key === infoKey && entry.target === target ? entry.value : "idle";

    return { copy, getStatus };
}