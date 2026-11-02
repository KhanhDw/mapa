import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
    createElectricPole,
    deleteElectricPole,
    fetchElectricPoles,
    updateElectricPole,
} from "../../../../api/electricPoles";
import type {
    ElectricPole,
    ElectricPoleInput,
    ElectricPoleStatus,
} from "../../../../api/electricPoles";
import "./PoleManagementPanel.css";

interface Props {
    onClose: () => void;
    onChanged: () => void;
    isRecordingLocation: boolean;
    onStartLocationRecording: (
        onLocationRecorded: (location: { lng: number; lat: number }) => void
    ) => void;
    onStopLocationRecording: () => void;
}

interface PoleDraft {
    pole_code: string;
    route: string;
    status: ElectricPoleStatus;
    lng: string;
    lat: string;
    detail: string;
}

const EMPTY_DRAFT: PoleDraft = {
    pole_code: "",
    route: "",
    status: "good",
    lng: "",
    lat: "",
    detail: "",
};

const STATUS_LABELS: Record<ElectricPoleStatus, string> = {
    good: "Bình thường",
    warning: "Cảnh báo",
    error: "Sự cố",
};

function toDraft(pole: ElectricPole): PoleDraft {
    return {
        pole_code: pole.pole_code,
        route: pole.route,
        status: pole.status,
        lng: String(pole.lng),
        lat: String(pole.lat),
        detail: pole.detail ?? "",
    };
}

export function PoleManagementPanel({
    onClose,
    onChanged,
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
}: Props) {
    const [poles, setPoles] = useState<ElectricPole[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [editingPole, setEditingPole] = useState<ElectricPole | null>(null);
    const [draft, setDraft] = useState<PoleDraft>(EMPTY_DRAFT);

    const loadPoles = useCallback(async () => {
        try {
            const items = await fetchElectricPoles();
            setPoles(items);
            setError(null);
        } catch (loadError) {
            setError((loadError as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        fetchElectricPoles()
            .then((items) => {
                if (active) setPoles(items);
            })
            .catch((loadError: unknown) => {
                if (active) setError((loadError as Error).message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const updateDraft = <K extends keyof PoleDraft>(key: K, value: PoleDraft[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const stopLocationRecording = () => {
        if (isRecordingLocation) onStopLocationRecording();
    };

    const toggleLocationRecording = () => {
        if (isRecordingLocation) {
            onStopLocationRecording();
            return;
        }
        onStartLocationRecording(({ lng, lat }) => {
            setDraft((current) => ({
                ...current,
                lng: String(lng),
                lat: String(lat),
            }));
        });
    };

    const beginCreate = () => {
        stopLocationRecording();
        setEditingPole(null);
        setDraft(EMPTY_DRAFT);
        setError(null);
    };

    const beginEdit = (pole: ElectricPole) => {
        stopLocationRecording();
        setEditingPole(pole);
        setDraft(toDraft(pole));
        setError(null);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!draft.lng.trim() || !draft.lat.trim()) {
            setError("Hãy ghi nhận vị trí trên bản đồ.");
            return;
        }
        if (!apiKey.trim()) {
            setError("Nhập API Key để thêm hoặc cập nhật trụ điện.");
            return;
        }

        const pole: ElectricPoleInput = {
            pole_code: draft.pole_code.trim(),
            route: draft.route.trim(),
            status: draft.status,
            lng: Number(draft.lng),
            lat: Number(draft.lat),
            detail: draft.detail.trim() || null,
        };
        if (
            !Number.isFinite(pole.lng) ||
            !Number.isFinite(pole.lat) ||
            pole.lng < -180 ||
            pole.lng > 180 ||
            pole.lat < -90 ||
            pole.lat > 90
        ) {
            setError("Tọa độ không hợp lệ.");
            return;
        }

        setBusy(true);
        setError(null);
        try {
            if (editingPole) {
                await updateElectricPole(editingPole.id, pole, apiKey.trim());
            } else {
                await createElectricPole(pole, apiKey.trim());
            }
            setEditingPole(null);
            setDraft(EMPTY_DRAFT);
            await loadPoles();
            onChanged();
        } catch (saveError) {
            setError((saveError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (pole: ElectricPole) => {
        if (!apiKey.trim()) {
            setError("Nhập API Key để xóa trụ điện.");
            return;
        }
        if (!window.confirm(`Xóa trụ điện ${pole.pole_code}?`)) return;

        setBusy(true);
        setError(null);
        try {
            await deleteElectricPole(pole.id, apiKey.trim());
            if (editingPole?.id === pole.id) beginCreate();
            await loadPoles();
            onChanged();
        } catch (deleteError) {
            setError((deleteError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const visiblePoles = poles.filter((pole) => {
        const query = search.trim().toLocaleLowerCase();
        return (
            !query ||
            pole.pole_code.toLocaleLowerCase().includes(query) ||
            pole.route.toLocaleLowerCase().includes(query)
        );
    });

    return (
        <aside className="coord-sidebar pole-management" aria-label="Quản lý trụ điện">
            <header className="coord-sidebar__header">
                <div>
                    <h2>Quản lý trụ điện</h2>
                    <p className="cs-muted">Danh sách và dữ liệu trụ trên hệ thống</p>
                </div>
                <button type="button" className="coord-sidebar__close" onClick={onClose} aria-label="Đóng">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            <div className="coord-sidebar__scroll pole-management__content">
                <label className="pole-management__field">
                    <span>API Key (chỉ lưu trong phiên này)</span>
                    <input
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder="Nhập WRITE_API_KEY để ghi dữ liệu"
                    />
                </label>

                <form className="pole-management__form" onSubmit={handleSubmit}>
                    <h3>{editingPole ? "Cập nhật trụ điện" : "Thêm trụ điện"}</h3>
                    <label className="pole-management__field">
                        <span>Mã trụ</span>
                        <input
                            required
                            maxLength={100}
                            value={draft.pole_code}
                            onChange={(event) => updateDraft("pole_code", event.target.value)}
                        />
                    </label>
                    <label className="pole-management__field">
                        <span>Tuyến đường</span>
                        <input
                            required
                            maxLength={300}
                            value={draft.route}
                            onChange={(event) => updateDraft("route", event.target.value)}
                        />
                    </label>
                    <label className="pole-management__field">
                        <span>Trạng thái</span>
                        <select
                            value={draft.status}
                            onChange={(event) => updateDraft("status", event.target.value as ElectricPoleStatus)}
                        >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <div className="pole-management__location">
                        <button
                            className={`electric-btn electric-btn--outline pole-management__location-button${isRecordingLocation ? " is-active" : ""}`}
                            type="button"
                            aria-pressed={isRecordingLocation}
                            onClick={toggleLocationRecording}
                        >
                            {isRecordingLocation ? "Hủy ghi nhận vị trí" : "Ghi nhận vị trí"}
                        </button>
                        <p className="cs-muted" role="status">
                            {isRecordingLocation
                                ? "Nhấp vào bản đồ để ghi nhận tọa độ trụ điện."
                                : draft.lng && draft.lat
                                  ? `Vị trí: ${draft.lat}, ${draft.lng}`
                                  : "Chưa ghi nhận vị trí."}
                        </p>
                    </div>
                    <label className="pole-management__field">
                        <span>Thông tin chi tiết (không bắt buộc)</span>
                        <textarea
                            maxLength={5000}
                            rows={3}
                            value={draft.detail}
                            onChange={(event) => updateDraft("detail", event.target.value)}
                        />
                    </label>
                    <div className="pole-management__actions">
                        <button className="electric-btn electric-btn--primary" type="submit" disabled={busy}>
                            {busy ? "Đang lưu..." : editingPole ? "Cập nhật" : "Thêm trụ"}
                        </button>
                        {editingPole && (
                            <button
                                className="electric-btn electric-btn--outline"
                                type="button"
                                onClick={beginCreate}
                                disabled={busy}
                            >
                                Hủy sửa
                            </button>
                        )}
                    </div>
                </form>

                {error && <p className="pole-management__error" role="alert">{error}</p>}

                <div className="pole-management__list-header">
                    <h3>Trụ điện ({poles.length})</h3>
                    <input
                        aria-label="Tìm trụ điện"
                        placeholder="Tìm mã trụ hoặc tuyến..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                {loading ? (
                    <p className="cs-muted" role="status">Đang tải danh sách trụ điện...</p>
                ) : visiblePoles.length === 0 ? (
                    <p className="cs-muted">{poles.length ? "Không tìm thấy trụ phù hợp." : "Chưa có trụ điện nào."}</p>
                ) : (
                    <div className="pole-management__list">
                        {visiblePoles.map((pole) => (
                            <article className="pole-management__card" key={pole.id}>
                                <div className="pole-management__card-heading">
                                    <strong>{pole.pole_code}</strong>
                                    <span className={`electric-badge electric-badge--${pole.status}`}>
                                        {STATUS_LABELS[pole.status]}
                                    </span>
                                </div>
                                <p>{pole.route}</p>
                                <div className="pole-management__card-actions">
                                    <button type="button" onClick={() => beginEdit(pole)} disabled={busy}>Sửa</button>
                                    <button type="button" onClick={() => void handleDelete(pole)} disabled={busy}>Xóa</button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
