import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    onGoToPole: (pole: ElectricPole) => void;
}

interface PoleDraft {
    pole_code: string;
    route: string;
    status: ElectricPoleStatus;
    lng: string;
    lat: string;
    detail: string;
}

type StatusFilter = "all" | ElectricPoleStatus;

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
    onGoToPole
}: Props) {
    const [poles, setPoles] = useState<ElectricPole[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [apiKey, setApiKey] = useState("");

    const [editingPole, setEditingPole] = useState<ElectricPole | null>(null);
    const [draft, setDraft] = useState<PoleDraft>(EMPTY_DRAFT);
    const [showForm, setShowForm] = useState(false);
    const [selectedPole, setSelectedPole] = useState<ElectricPole | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const formRef = useRef<HTMLFormElement | null>(null);

    /* ── Data loading ─────────────────────────── */
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

    /* ── Derived data ─────────────────────────── */
    const stats = useMemo(
        () => ({
            total: poles.length,
            good: poles.filter((p) => p.status === "good").length,
            warning: poles.filter((p) => p.status === "warning").length,
            error: poles.filter((p) => p.status === "error").length,
        }),
        [poles]
    );

    const visiblePoles = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return poles.filter((pole) => {
            if (statusFilter !== "all" && pole.status !== statusFilter) return false;
            return (
                !query ||
                pole.pole_code.toLocaleLowerCase().includes(query) ||
                pole.route.toLocaleLowerCase().includes(query)
            );
        });
    }, [poles, search, statusFilter]);

    /* ── Draft helpers ────────────────────────── */
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

    /* ── Form open / close ────────────────────── */
    const openCreate = () => {
        stopLocationRecording();
        setEditingPole(null);
        setDraft(EMPTY_DRAFT);
        setError(null);
        setShowForm(true);
    };

    const beginEdit = (pole: ElectricPole) => {
        stopLocationRecording();
        setSelectedPole(null);
        setEditingPole(pole);
        setDraft(toDraft(pole));
        setError(null);
        setShowForm(true);
    };

    const closeForm = () => {
        stopLocationRecording();
        setEditingPole(null);
        setDraft(EMPTY_DRAFT);
        setError(null);
        setShowForm(false);
    };

    useEffect(() => {
        if (showForm && formRef.current) {
            const id = requestAnimationFrame(() => {
                formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
            return () => cancelAnimationFrame(id);
        }
    }, [showForm, editingPole]);

    useEffect(() => {
        if (isRecordingLocation) setShowForm(true);
    }, [isRecordingLocation]);

    /* ── Handlers ─────────────────────────────── */
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await loadPoles();
        } finally {
            setRefreshing(false);
        }
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
            setShowForm(false);
            await loadPoles();
            onChanged();
        } catch (saveError) {
            setError((saveError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (pole: ElectricPole) => {
        setConfirmDeleteId(null);
        if (!apiKey.trim()) {
            setError("Nhập API Key để xóa trụ điện.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await deleteElectricPole(pole.id, apiKey.trim());
            if (editingPole?.id === pole.id) closeForm();
            await loadPoles();
            onChanged();
        } catch (deleteError) {
            setError((deleteError as Error).message);
        } finally {
            setBusy(false);
            // Trong handleDelete, sau khi xóa thành công:
            if (editingPole?.id === pole.id) closeForm();
            if (selectedPole?.id === pole.id) setSelectedPole(null);  // ← THÊM
        }
    };

    const hasLocation = Boolean(draft.lng.trim() && draft.lat.trim());
    const locationLabel = hasLocation
        ? `${Number(draft.lat).toFixed(5)}, ${Number(draft.lng).toFixed(5)}`
        : "Ghi nhận vị trí trên bản đồ";

    /* ── Render ───────────────────────────────── */
    return (
        <aside className="coord-sidebar pole-management pole-dashboard" aria-label="Quản lý trụ điện">
            <header className="pole-dashboard__header">
                {selectedPole ? (
                    <>
                        <button
                            type="button"
                            className="pole-dashboard__icon-btn"
                            onClick={() => {
                                setSelectedPole(null);
                                setConfirmDeleteId(null);
                            }}
                            aria-label="Quay lại danh sách"
                            title="Quay lại"
                        >
                            <BackIcon />
                        </button>
                        <div className="pole-dashboard__title">
                            <h2>{selectedPole.pole_code}</h2>
                            <p>Chi tiết trụ điện</p>
                        </div>
                        <button
                            type="button"
                            className="pole-dashboard__icon-btn"
                            onClick={onClose}
                            aria-label="Đóng"
                        >
                            <CloseIcon />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="pole-dashboard__title">
                            <h2>Quản lý trụ điện</h2>
                            <p>Tổng quan và quản trị hệ thống trụ</p>
                        </div>
                        <div className="pole-dashboard__header-actions">
                            <button
                                type="button"
                                className="pole-dashboard__icon-btn"
                                onClick={handleRefresh}
                                disabled={refreshing}
                                aria-label="Tải lại dữ liệu"
                                title="Tải lại"
                            >
                                <RefreshIcon spinning={refreshing} />
                            </button>
                            <button
                                type="button"
                                className="pole-dashboard__icon-btn"
                                onClick={onClose}
                                aria-label="Đóng"
                                title="Đóng"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                    </>
                )}
            </header>

            {selectedPole ? (
                <PoleDetailView
                    pole={selectedPole}
                    confirmDelete={confirmDeleteId === selectedPole.id}
                    busy={busy}
                    onGoToPole={onGoToPole}
                    onEdit={() => beginEdit(selectedPole)}
                    onRequestDelete={() => setConfirmDeleteId(selectedPole.id)}
                    onConfirmDelete={() => void handleDelete(selectedPole)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                />
            ) : (

                <div className="coord-sidebar__scroll pole-dashboard__scroll">
                    {/* KPI Stats */}
                    <div className="pole-dashboard__stats">
                        <div className="pole-dashboard__stat pole-dashboard__stat--total">
                            <span className="pole-dashboard__stat-label">Tổng số trụ</span>
                            <span className="pole-dashboard__stat-value">{stats.total}</span>
                        </div>
                        <div className="pole-dashboard__stat pole-dashboard__stat--good">
                            <span className="pole-dashboard__stat-label">Bình thường</span>
                            <span className="pole-dashboard__stat-value">{stats.good}</span>
                        </div>
                        <div className="pole-dashboard__stat pole-dashboard__stat--warning">
                            <span className="pole-dashboard__stat-label">Cảnh báo</span>
                            <span className="pole-dashboard__stat-value">{stats.warning}</span>
                        </div>
                        <div className="pole-dashboard__stat pole-dashboard__stat--error">
                            <span className="pole-dashboard__stat-label">Sự cố</span>
                            <span className="pole-dashboard__stat-value">{stats.error}</span>
                        </div>
                    </div>

                    {/* API key */}
                    <div className="pole-dashboard__section">
                        <label className="pole-dashboard__field">
                            <span>API Key (chỉ lưu trong phiên này)</span>
                            <input
                                type="password"
                                autoComplete="off"
                                value={apiKey}
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder="Nhập WRITE_API_KEY để ghi dữ liệu"
                            />
                        </label>
                    </div>

                    {/* Form toggle / Form */}
                    {!showForm ? (
                        <button
                            type="button"
                            className="pole-dashboard__form-toggle"
                            onClick={openCreate}
                        >
                            <span className="pole-dashboard__form-toggle-label">
                                <PlusIcon /> Thêm trụ điện mới
                            </span>
                            <ChevronRightIcon />
                        </button>
                    ) : (
                        <form
                            ref={formRef}
                            className="pole-dashboard__form"
                            onSubmit={handleSubmit}
                        >
                            <h3>{editingPole ? "Cập nhật trụ điện" : "Thêm trụ điện mới"}</h3>

                            <label className="pole-dashboard__field">
                                <span>Mã trụ</span>
                                <input
                                    required
                                    maxLength={100}
                                    value={draft.pole_code}
                                    onChange={(event) => updateDraft("pole_code", event.target.value)}
                                />
                            </label>

                            <label className="pole-dashboard__field">
                                <span>Tuyến đường</span>
                                <input
                                    required
                                    maxLength={300}
                                    value={draft.route}
                                    onChange={(event) => updateDraft("route", event.target.value)}
                                />
                            </label>

                            <label className="pole-dashboard__field">
                                <span>Trạng thái</span>
                                <select
                                    value={draft.status}
                                    onChange={(event) =>
                                        updateDraft("status", event.target.value as ElectricPoleStatus)
                                    }
                                >
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="pole-dashboard__field">
                                <span>Vị trí</span>
                                <button
                                    type="button"
                                    className={`pole-dashboard__location-btn${isRecordingLocation ? " is-active" : ""}`}
                                    aria-pressed={isRecordingLocation}
                                    onClick={toggleLocationRecording}
                                >
                                    <MapPinIcon />
                                    <span className="pole-dashboard__location-label">
                                        {isRecordingLocation
                                            ? "Nhấp vào bản đồ để chọn..."
                                            : locationLabel}
                                    </span>
                                    {isRecordingLocation && <span className="pole-dashboard__pulse" />}
                                </button>
                            </div>

                            <label className="pole-dashboard__field pole-dashboard__field--full">
                                <span>Thông tin chi tiết (không bắt buộc)</span>
                                <textarea
                                    maxLength={5000}
                                    rows={3}
                                    value={draft.detail}
                                    onChange={(event) => updateDraft("detail", event.target.value)}
                                />
                            </label>

                            <div className="pole-dashboard__form-actions">
                                <button
                                    className="pole-dashboard__btn pole-dashboard__btn--primary"
                                    type="submit"
                                    disabled={busy}
                                >
                                    {busy ? "Đang lưu..." : editingPole ? "Cập nhật" : "Thêm trụ"}
                                </button>
                                <button
                                    className="pole-dashboard__btn pole-dashboard__btn--ghost"
                                    type="button"
                                    onClick={closeForm}
                                    disabled={busy}
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="pole-dashboard__error" role="alert">
                            <AlertIcon />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* List header */}
                    <div className="pole-dashboard__list-header">
                        <div className="pole-dashboard__list-title">
                            <h3>Danh sách trụ điện</h3>
                            <span>
                                {visiblePoles.length}/{poles.length}
                            </span>
                        </div>

                        <div className="pole-dashboard__filters" role="tablist">
                            <FilterChip
                                active={statusFilter === "all"}
                                onClick={() => setStatusFilter("all")}
                                label="Tất cả"
                                count={stats.total}
                            />
                            <FilterChip
                                active={statusFilter === "good"}
                                onClick={() => setStatusFilter("good")}
                                label="Bình thường"
                                count={stats.good}
                            />
                            <FilterChip
                                active={statusFilter === "warning"}
                                onClick={() => setStatusFilter("warning")}
                                label="Cảnh báo"
                                count={stats.warning}
                            />
                            <FilterChip
                                active={statusFilter === "error"}
                                onClick={() => setStatusFilter("error")}
                                label="Sự cố"
                                count={stats.error}
                            />
                        </div>

                        <div className="pole-dashboard__search">
                            <SearchIcon />
                            <input
                                aria-label="Tìm trụ điện"
                                placeholder="Tìm mã trụ hoặc tuyến..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="pole-dashboard__list">
                            <div className="pole-dashboard__skeleton" />
                            <div className="pole-dashboard__skeleton" />
                            <div className="pole-dashboard__skeleton" />
                        </div>
                    ) : visiblePoles.length === 0 ? (
                        <div className="pole-dashboard__empty">
                            <PoleIcon />
                            <h4>
                                {poles.length
                                    ? "Không có trụ phù hợp"
                                    : "Chưa có trụ điện nào"}
                            </h4>
                            <p>
                                {poles.length
                                    ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
                                    : "Bắt đầu bằng cách thêm trụ điện đầu tiên."}
                            </p>
                            {!poles.length && (
                                <button
                                    type="button"
                                    className="pole-dashboard__btn pole-dashboard__btn--primary"
                                    onClick={openCreate}
                                    style={{ marginTop: 8 }}
                                >
                                    <PlusIcon /> Thêm trụ điện
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="pole-dashboard__list">
                            {visiblePoles.map((pole) => (
                                <article className="pole-dashboard__card" key={pole.id}>
                                    <button
                                        type="button"
                                        className="pole-dashboard__card-main"
                                        onClick={() => setSelectedPole(pole)}
                                        aria-label={`Xem chi tiết ${pole.pole_code}`}
                                    >
                                        <div className="pole-dashboard__card-head">
                                            <div className="pole-dashboard__card-title">
                                                <span className="pole-dashboard__card-code">{pole.pole_code}</span>
                                                <span className="pole-dashboard__card-route">{pole.route}</span>
                                            </div>
                                            <span className={`pole-dashboard__badge pole-dashboard__badge--${pole.status}`}>
                                                {STATUS_LABELS[pole.status]}
                                            </span>
                                        </div>

                                        {pole.detail && (
                                            <p className="pole-dashboard__card-detail">{pole.detail}</p>
                                        )}

                                        <div className="pole-dashboard__card-meta">
                                            <MapPinIcon size={12} />
                                            <span>
                                                {pole.lat.toFixed(5)}, {pole.lng.toFixed(5)}
                                            </span>
                                        </div>
                                    </button>

                                    {confirmDeleteId === pole.id ? (
                                        <div className="pole-dashboard__confirm">
                                            <span>Xóa trụ này?</span>
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(pole)}
                                                disabled={busy}
                                            >
                                                Xóa
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDeleteId(null)}
                                                disabled={busy}
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="pole-dashboard__card-actions">
                                            <button
                                                type="button"
                                                className="pole-dashboard__card-action"
                                                onClick={() => beginEdit(pole)}
                                                disabled={busy}
                                            >
                                                <EditIcon /> Sửa
                                            </button>
                                            <button
                                                type="button"
                                                className="pole-dashboard__card-action pole-dashboard__card-action--danger"
                                                onClick={() => setConfirmDeleteId(pole.id)}
                                                disabled={busy}
                                            >
                                                <TrashIcon /> Xóa
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

/* ── Small subcomponents ───────────────────── */
function FilterChip({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            className={`pole-dashboard__filter${active ? " is-active" : ""}`}
            onClick={onClick}
        >
            {label}
            <span className="pole-dashboard__filter-count">{count}</span>
        </button>
    );
}

/* ── Icons ─────────────────────────────────── */
function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
    );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={spinning ? { animation: "pole-spin 1s linear infinite" } : undefined}
        >
            <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" />
            <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
    );
}

function MapPinIcon({ size = 14 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2" />
        </svg>
    );
}

function EditIcon() {
    return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" strokeLinecap="round" />
            <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function AlertIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
        </svg>
    );
}

function PoleIcon() {
    return (
        <svg viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M32 10v44" strokeLinecap="round" />
            <path d="M16 18h32M16 26h32" strokeLinecap="round" />
            <path d="M22 10 32 4l10 6" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M24 54h16" strokeLinecap="round" />
        </svg>
    );
}
function PoleDetailView({
    pole,
    confirmDelete,
    busy,
    onGoToPole,
    onEdit,
    onRequestDelete,
    onConfirmDelete,
    onCancelDelete,
}: {
    pole: ElectricPole;
    confirmDelete: boolean;
    busy: boolean;
    onGoToPole: (pole: ElectricPole) => void;
    onEdit: () => void;
    onRequestDelete: () => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
}) {
    const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const handleCopy = async () => {
        const text = `${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}`;
        window.clearTimeout(timer.current);
        try {
            await navigator.clipboard.writeText(text);
            setCopyState("ok");
        } catch {
            setCopyState("fail");
        }
        timer.current = window.setTimeout(() => setCopyState("idle"), 2000);
    };

    return (
        <div className="coord-sidebar__scroll pole-dashboard__scroll">
            <div className="pole-dashboard__detail-card">
                <div className="pole-dashboard__detail-row">
                    <span className="pole-dashboard__detail-label">Trạng thái</span>
                    <span className={`pole-dashboard__badge pole-dashboard__badge--${pole.status}`}>
                        {STATUS_LABELS[pole.status]}
                    </span>
                </div>
                <div className="pole-dashboard__detail-row">
                    <span className="pole-dashboard__detail-label">Mã trụ</span>
                    <span className="pole-dashboard__detail-value">{pole.pole_code}</span>
                </div>
                <div className="pole-dashboard__detail-row">
                    <span className="pole-dashboard__detail-label">Tuyến đường</span>
                    <span className="pole-dashboard__detail-value">{pole.route || "—"}</span>
                </div>
            </div>

            <div className="pole-dashboard__detail-card">
                <div className="pole-dashboard__detail-header">
                    <span>Vị trí</span>
                    <button
                        type="button"
                        className="pole-dashboard__copy-btn"
                        onClick={handleCopy}
                    >
                        {copyState === "ok"
                            ? "Đã chép"
                            : copyState === "fail"
                                ? "Thử lại"
                                : "Sao chép"}
                    </button>
                </div>
                <div className="pole-dashboard__detail-coords">
                    <div>
                        <span>LAT</span>
                        <span>{pole.lat.toFixed(6)}</span>
                    </div>
                    <div>
                        <span>LNG</span>
                        <span>{pole.lng.toFixed(6)}</span>
                    </div>
                </div>
                <button
                    type="button"
                    className="pole-dashboard__btn pole-dashboard__btn--primary"
                    onClick={() => onGoToPole(pole)}
                >
                    <MapPinIcon /> Đến vị trí
                </button>
            </div>

            {pole.detail && (
                <div className="pole-dashboard__detail-card">
                    <span className="pole-dashboard__detail-label">Thông tin chi tiết</span>
                    <p className="pole-dashboard__detail-text">{pole.detail}</p>
                </div>
            )}

            <div className="pole-dashboard__detail-card">
                <span className="pole-dashboard__detail-label">Lịch sử</span>
                <div className="pole-dashboard__detail-row">
                    <span className="pole-dashboard__detail-label">Tạo lúc</span>
                    <span className="pole-dashboard__detail-value">
                        {new Date(pole.created_at).toLocaleString("vi-VN")}
                    </span>
                </div>
                <div className="pole-dashboard__detail-row">
                    <span className="pole-dashboard__detail-label">Cập nhật</span>
                    <span className="pole-dashboard__detail-value">
                        {new Date(pole.updated_at).toLocaleString("vi-VN")}
                    </span>
                </div>
            </div>

            {confirmDelete ? (
                <div className="pole-dashboard__confirm">
                    <span>Xóa trụ này?</span>
                    <button type="button" onClick={onConfirmDelete} disabled={busy}>
                        Xóa
                    </button>
                    <button type="button" onClick={onCancelDelete} disabled={busy}>
                        Hủy
                    </button>
                </div>
            ) : (
                <div className="pole-dashboard__detail-actions">
                    <button type="button" onClick={onEdit} disabled={busy}>
                        <EditIcon /> Sửa
                    </button>
                    <button type="button" onClick={onRequestDelete} disabled={busy}>
                        <TrashIcon /> Xóa
                    </button>
                </div>
            )}
        </div>
    );
}

function BackIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}