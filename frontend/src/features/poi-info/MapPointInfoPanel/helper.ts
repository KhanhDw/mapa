import { CATEGORY_LABEL } from "./contants.ts";


export function toDMS(value: number, pos: string, neg: string): string {
    if (!Number.isFinite(value)) return "—";
    const dir = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d) * 60 - m) * 60;
    return `${d}°${m}′${s.toFixed(1)}″${dir}`;
}

export function formatDistance(m: number | null | undefined): string {
    if (m == null || !Number.isFinite(m) || m < 0) return "—";
    if (m < 10) return "<10 m";
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
}

export function categoryLabel(cat: string | null): string | null {
    if (!cat) return null;
    return CATEGORY_LABEL[cat] ?? cat;
}