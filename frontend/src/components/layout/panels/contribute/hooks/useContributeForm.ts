import { useState } from "react";
import { CONTRIBUTE_BASE } from "../../../../../config.ts";

export const CONTRIBUTE_CATEGORIES = [
    { value: "cafe", label: "Cà phê" },
    { value: "restaurant", label: "Nhà hàng" },
    { value: "fast_food", label: "Đồ ăn nhanh" },
    { value: "bar", label: "Quán bar" },
    { value: "hotel", label: "Khách sạn" },
    { value: "hostel", label: "Nhà nghỉ" },
    { value: "school", label: "Trường học" },
    { value: "university", label: "Đại học" },
    { value: "hospital", label: "Bệnh viện" },
    { value: "pharmacy", label: "Nhà thuốc" },
    { value: "clinic", label: "Phòng khám" },
    { value: "supermarket", label: "Siêu thị" },
    { value: "convenience", label: "Cửa hàng tiện lợi" },
    { value: "mall", label: "Trung tâm TM" },
    { value: "bank", label: "Ngân hàng" },
    { value: "atm", label: "ATM" },
    { value: "post_office", label: "Bưu điện" },
    { value: "fuel", label: "Cây xăng" },
    { value: "parking", label: "Bãi đỗ xe" },
    { value: "attraction", label: "Điểm tham quan" },
    { value: "other", label: "Khác" },
] as const;

export interface PoiDraft {
    lng: number | null;
    lat: number | null;
    name: string;
    category: string;
    address: string;
    phone: string;
    description: string;
    photos: File[];
}

const EMPTY: PoiDraft = {
    lng: null, lat: null,
    name: "", category: "cafe",
    address: "", phone: "", description: "",
    photos: [],
};

export interface CreatePoiResult {
    id: number;
    name: string;
    lng: number;
    lat: number;
}

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

        setSubmitting(true);
        setError(null);

        try {
            // 1. Create POI
            const res = await fetch(`${CONTRIBUTE_BASE}/poi`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
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
                id: data.id, name: data.name, lng: data.lng, lat: data.lat,
            };

            // 2. Upload ảnh (nếu có)
            for (const file of draft.photos) {
                const fd = new FormData();
                fd.append("file", file);
                const upRes = await fetch(`${CONTRIBUTE_BASE}/photos/${result.id}`, {
                    method: "POST",
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