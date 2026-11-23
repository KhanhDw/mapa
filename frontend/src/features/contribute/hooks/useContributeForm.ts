import { useState } from "react";
import { CONTRIBUTE_BASE } from "../../../core/config/index.ts";
import { getAuthToken } from "../../auth/storage";
import { type CreatePoiResult, EMPTY, type PoiDraft } from "../types";



export function useContributeForm() {
    const [draft, setDraft] = useState<PoiDraft>(EMPTY);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState<CreatePoiResult | null>(null);

    function update<K extends keyof PoiDraft>(key: K, value: PoiDraft[K]) {
        setDraft((p) => ({ ...p, [key]: value }));
    }

    function setLocation(lng: number, lat: number) {
        setDraft((p) => ({ ...p, lng, lat }));
    }

    function reset() {
        setDraft(EMPTY);
        setError(null);
        setCreated(null);
    }

    async function submit(): Promise<CreatePoiResult | null> {
        if (draft.lng == null || draft.lat == null) {
            setError("Chưa chọn vị trí trên bản đồ");
            return null;
        }
        if (!draft.name.trim()) {
            setError("Tên địa điểm không được để trống");
            return null;
        }

        const token = getAuthToken(); //[cite: 3]
        if (!token) {
            setError("Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập");
            return null;
        }

        const authHeaders: Record<string, string> = {
            Authorization: `Bearer ${token}`,
        };

        setSubmitting(true);
        setError(null);

        try {
            // 1. Create POI
            const res = await fetch(`${CONTRIBUTE_BASE}/poi`, { //[cite: 1]
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders,
                },
                body: JSON.stringify({
                    lng: draft.lng,
                    lat: draft.lat,
                    name: draft.name.trim(),
                    category: draft.category,
                    address: draft.address.trim() || null,
                    phone: draft.phone.trim() || null,
                    description: draft.description.trim() || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? `HTTP ${res.status}`);
            }
            const data = await res.json();
            const result: CreatePoiResult = {
                id: data.id,
                name: data.name,
                lng: data.lng,
                lat: data.lat,
            };

            // 2. Upload ảnh (nếu có)
            for (const file of draft.photos) {
                const fd = new FormData();
                fd.append("file", file);
                const upRes = await fetch(`${CONTRIBUTE_BASE}/photos/${result.id}`, { //[cite: 1]
                    method: "POST",
                    headers: {
                        ...authHeaders,
                    },
                    body: fd,
                });
                if (!upRes.ok) {
                    console.warn("[contribute] upload photo fail:", file.name, upRes.status);
                }
            }

            setCreated(result);
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Lỗi không xác định");
            return null;
        } finally {
            setSubmitting(false);
        }
    }

    return { draft, update, setLocation, reset, submit, submitting, error, created };
}