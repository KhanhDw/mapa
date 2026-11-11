import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_API_KEY } from "../../../api/streetview";
import { deleteUserPoi, fetchSystemPois, fetchUserPois, updateUserPoi } from "../../../api/pois";
import type { PoiItem } from "../../../api/pois";
import "./PoiManagementPanel.css";

interface Props {
    onClose: () => void;
    onChanged: () => void;
    isRecordingLocation: boolean;
    onStartLocationRecording: (cb: (loc: { lng: number; lat: number }) => void) => void;
    onStopLocationRecording: () => void;
    onGoToPoi: (poi: PoiItem) => void;
}

type SourceTab = "user" | "system";
type Mode = "list" | "detail";

const PAGE_SIZE = 50;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra");

interface PoiDraft {
    name: string;
    category: string;
    address: string;
    lng: string;
    lat: string;
}

export function PoiManagementPanel({
    onClose,
    onChanged,
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    onGoToPoi,
}: Props) {
    const [tab, setTab] = useState<SourceTab>("user");
    const [pois, setPois] = useState<PoiItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
    const [apiKeyError, setApiKeyError] = useState(false);

    const [mode, setMode] = useState<Mode>("list");
    const [selected, setSelected] = useState<PoiItem | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);
    const [editing, setEditing] = useState<PoiItem | null>(null);
    const [draft, setDraft] = useState<PoiDraft>({ name: "", category: "", address: "", lng: "", lat: "" });

    const requestSeq = useRef(0);
    const recordingRef = useRef(isRecordingLocation);
    const stopRecordingRef = useRef(onStopLocationRecording);
    recordingRef.current = isRecordingLocation;
    stopRecordingRef.current = onStopLocationRecording;

    useEffect(() => () => {
        if (recordingRef.current) stopRecordingRef.current();
    }, []);

    const loadPage = useCallback(async (offset: number, isMore = false) => {
        const seq = ++requestSeq.current;
        if (!isMore) setLoading(true);
        try {
            const res = tab === "user"
                ? await fetchUserPois({ search: debouncedSearch, limit: PAGE_SIZE, offset })
                : await fetchSystemPois({ search: debouncedSearch, limit: PAGE_SIZE, offset });

            if (seq !== requestSeq.current) return;
            setPois((cur) => {
                if (offset === 0) return res.items;
                const seen = new Set(cur.map((i) => i.id));
                return [...cur, ...res.items.filter((i) => !seen.has(i.id))];
            });
            setTotal(res.total);
            setError(null);
        } catch (e) {
            if (seq === requestSeq.current) setError(errMsg(e));
        } finally {
            if (seq === requestSeq.current) {
                setLoading(false);
                setLoadingMore(false);
                setRefreshing(false);
            }
        }
    }, [debouncedSearch, tab]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setSearch("");
        void loadPage(0);
    }, [tab, loadPage]);

    const hasMore = pois.length < total;

    const stopLocationRecording = () => {
        if (isRecordingLocation) onStopLocationRecording();
    };

    const applyLocation = useCallback(({ lng, lat }: { lng: number; lat: number }) => {
        setDraft((c) => ({ ...c, lng: String(lng), lat: String(lat) }));
    }, []);

    const toggleLocationRecording = () => {
        if (isRecordingLocation) {
            onStopLocationRecording();
            return;
        }
        onStartLocationRecording(applyLocation);
    };

    const closeEditForm = () => {
        stopLocationRecording();
        setEditing(null);
        setError(null);
    };

    const beginEdit = (item: PoiItem) => {
        stopLocationRecording();
        setSelected(null);
        setMode("list");
        setConfirmDeleteId(null);
        setEditing(item);
        setDraft({
            name: item.name || "",
            category: item.category,
            address: item.address || "",
            lng: String(item.lng),
            lat: String(item.lat),
        });
        setError(null);
    };

    const openDetail = (item: PoiItem) => {
        stopLocationRecording();
        setEditing(null);
        setSelected(item);
        setMode("detail");
        setError(null);
    };

    const handleBack = () => {
        setSelected(null);
        setMode("list");
        setError(null);
    };

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await loadPage(0);
    };

    const handleLoadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        void loadPage(pois.length, true);
    };

    const handleSubmitEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editing || busy) return;

        if (!apiKey.trim()) {
            setApiKeyError(true);
            return setError("Vui lòng nhập API key để lưu thay đổi");
        }
        setApiKeyError(false);

        const lng = Number(draft.lng.trim().replace(",", "."));
        const lat = Number(draft.lat.trim().replace(",", "."));

        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            return setError("Tọa độ kinh độ / vĩ độ không hợp lệ");
        }

        setBusy(true);
        setError(null);
        try {
            const updated = await updateUserPoi(
                editing.id,
                { name: draft.name, category: draft.category, address: draft.address, lng, lat },
                apiKey.trim()
            );
            closeEditForm();
            await loadPage(0);
            onChanged();
            if (selected?.id === updated.id) setSelected(updated);
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (item: PoiItem) => {
        if (busy) return;
        if (!apiKey.trim()) {
            setApiKeyError(true);
            setConfirmDeleteId(null);
            return setError("Vui lòng nhập API key để xóa");
        }
        setApiKeyError(false);
        setBusy(true);
        setError(null);
        try {
            await deleteUserPoi(item.id, apiKey.trim());
            if (editing?.id === item.id) closeEditForm();
            if (selected?.id === item.id) {
                setSelected(null);
                setMode("list");
            }
            await loadPage(0);
            onChanged();
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setBusy(false);
            setConfirmDeleteId(null);
        }
    };

    const hasEditLocation = Boolean(draft.lng.trim() && draft.lat.trim());

    return (
        <aside className="coord-sidebar sv-management sv-dashboard" aria-label="Quản lý Địa điểm POI">
            <header className="sv-dashboard__header">
                {mode === "list" ? (
                    <>
                        <div className="sv-dashboard__title">
                            <strong>Quản lý Địa điểm (POI)</strong>
                            <span>{tab === "user" ? "Đóng góp bởi người dùng" : "Hệ thống OSM"}</span>
                        </div>
                        <div className="sv-dashboard__header-actions">
                            <button
                                type="button"
                                className="sv-icon-btn"
                                onClick={handleRefresh}
                                disabled={refreshing}
                                aria-label="Tải lại"
                            >
                                <RefreshIcon spinning={refreshing} />
                            </button>
                            <button type="button" className="sv-icon-btn" onClick={onClose} aria-label="Đóng">
                                <CloseIcon />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <button type="button" className="sv-icon-btn" onClick={handleBack} aria-label="Quay lại">
                            <BackIcon />
                        </button>
                        <div className="sv-dashboard__title">
                            <strong>{selected?.name || "Không tên"}</strong>
                            <span>Chi tiết địa điểm #{selected?.id}</span>
                        </div>
                        <button type="button" className="sv-icon-btn" onClick={onClose} aria-label="Đóng">
                            <CloseIcon />
                        </button>
                    </>
                )}
            </header>

            {mode === "detail" && selected ? (
                <div className="coord-sidebar__scroll sv-dashboard__scroll">
                    <div className="sv-panel-card">
                        <div className="sv-panel-card__head">
                            <span className="sv-panel-card__label">Thông tin chung</span>
                            <span className={`sv-badge ${selected.source === "user" ? "sv-badge--ok" : "sv-badge--info"}`}>
                                {selected.source === "user" ? "Người dùng đóng góp" : "Hệ thống OSM"}
                            </span>
                        </div>
                        <dl className="sv-dl">
                            <dt>Tên địa điểm</dt>
                            <dd><strong>{selected.name || "Không tên"}</strong></dd>
                            <dt>Danh mục</dt>
                            <dd>{selected.category}</dd>
                            <dt>Địa chỉ</dt>
                            <dd>{selected.address || "Không rõ"}</dd>
                        </dl>
                    </div>

                    <div className="sv-panel-card">
                        <div className="sv-panel-card__head">
                            <span className="sv-panel-card__label">Tọa độ không gian</span>
                        </div>
                        <div className="sv-coords">
                            <div>
                                <small>LAT</small>
                                <code>{selected.lat.toFixed(6)}</code>
                            </div>
                            <div>
                                <small>LNG</small>
                                <code>{selected.lng.toFixed(6)}</code>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="sv-btn sv-btn--primary sv-btn--block"
                            style={{ marginTop: "10px" }}
                            onClick={() => onGoToPoi(selected)}
                        >
                            <MapPinIcon size={16} /> Bay đến vị trí trên bản đồ
                        </button>
                    </div>

                    {selected.source === "user" && (
                        <>
                            <div className="sv-detail-actions" style={{ marginTop: "12px" }}>
                                <button type="button" className="sv-btn" onClick={() => beginEdit(selected)}>
                                    <EditIcon /> Sửa thông tin
                                </button>
                                <button
                                    type="button"
                                    className="sv-btn sv-btn--danger-outline"
                                    onClick={() => setConfirmDeleteId(selected.id)}
                                >
                                    <TrashIcon /> Xóa địa điểm
                                </button>
                            </div>

                            {confirmDeleteId === selected.id && (
                                <div className="sv-confirm sv-confirm--bar" style={{ marginTop: "10px" }}>
                                    <span>Xác nhận xóa địa điểm này khỏi hệ thống?</span>
                                    <button
                                        type="button"
                                        className="sv-btn sv-btn--danger"
                                        disabled={busy}
                                        onClick={() => handleDelete(selected)}
                                    >
                                        {busy ? "Đang xóa…" : "Xóa vĩnh viễn"}
                                    </button>
                                    <button type="button" className="sv-btn" onClick={() => setConfirmDeleteId(null)}>
                                        Hủy
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <div className="coord-sidebar__scroll sv-dashboard__scroll">
                    <div className="sv-chips" role="group" aria-label="Chọn nguồn dữ liệu" style={{ display: "flex", gap: "8px" }}>
                        <button
                            type="button"
                            className={`sv-chip ${tab === "user" ? "is-active" : ""}`}
                            onClick={() => setTab("user")}
                            style={{ flex: 1, padding: "8px" }}
                        >
                            👤 Người dùng đóng góp
                        </button>
                        <button
                            type="button"
                            className={`sv-chip ${tab === "system" ? "is-active" : ""}`}
                            onClick={() => setTab("system")}
                            style={{ flex: 1, padding: "8px" }}
                        >
                            🌐 Hệ thống OSM
                        </button>
                    </div>

                    {tab === "user" && (
                        <label className="sv-field">
                            <span>API key quản trị (dành cho Sửa/Xóa)</span>
                            <input
                                type="password"
                                className={apiKeyError ? "sv-input-error" : ""}
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    if (apiKeyError) setApiKeyError(false);
                                }}
                                placeholder="Nhập X-API-Key"
                                autoComplete="off"
                            />
                        </label>
                    )}

                    {editing && (
                        <form className="sv-form" onSubmit={handleSubmitEdit}>
                            <h3 className="sv-form__title">Chỉnh sửa POI #{editing.id}</h3>

                            <button
                                type="button"
                                className={`sv-location-btn${isRecordingLocation ? " is-recording" : ""}${hasEditLocation ? " has-value" : ""}`}
                                onClick={toggleLocationRecording}
                            >
                                <MapPinIcon size={16} />
                                <span>
                                    {isRecordingLocation
                                        ? "Bấm lên bản đồ để lấy tọa độ mới… (bấm để hủy)"
                                        : `Tọa độ: ${Number(draft.lat).toFixed(4)}, ${Number(draft.lng).toFixed(4)}`}
                                </span>
                            </button>

                            <label className="sv-field">
                                <span>Tên địa điểm *</span>
                                <input
                                    value={draft.name}
                                    onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
                                    required
                                />
                            </label>

                            <label className="sv-field">
                                <span>Danh mục *</span>
                                <input
                                    value={draft.category}
                                    onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value }))}
                                    required
                                />
                            </label>

                            <label className="sv-field">
                                <span>Địa chỉ</span>
                                <input
                                    value={draft.address}
                                    onChange={(e) => setDraft((c) => ({ ...c, address: e.target.value }))}
                                />
                            </label>

                            <div className="sv-form__row">
                                <label className="sv-field">
                                    <span>Kinh độ (Lng)</span>
                                    <input
                                        inputMode="decimal"
                                        value={draft.lng}
                                        onChange={(e) => setDraft((c) => ({ ...c, lng: e.target.value }))}
                                    />
                                </label>
                                <label className="sv-field">
                                    <span>Vĩ độ (Lat)</span>
                                    <input
                                        inputMode="decimal"
                                        value={draft.lat}
                                        onChange={(e) => setDraft((c) => ({ ...c, lat: e.target.value }))}
                                    />
                                </label>
                            </div>

                            <div className="sv-form__actions">
                                <button type="submit" className="sv-btn sv-btn--primary" disabled={busy}>
                                    {busy ? "Đang lưu…" : "Lưu thay đổi"}
                                </button>
                                <button type="button" className="sv-btn" onClick={closeEditForm}>
                                    Hủy
                                </button>
                            </div>
                        </form>
                    )}

                    {error && (
                        <div className="sv-alert" role="alert">
                            <AlertIcon />
                            <span>{error}</span>
                        </div>
                    )}

                    <section className="sv-list">
                        <div className="sv-list__head">
                            <h3>
                                Danh sách POI{" "}
                                <span className="sv-count">
                                    {pois.length}/{total}
                                </span>
                            </h3>
                            <label className="sv-search">
                                <SearchIcon />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={tab === "user" ? "Tìm theo tên hoặc địa chỉ..." : "Tìm tên địa điểm hệ thống..."}
                                />
                            </label>
                        </div>

                        {loading ? (
                            <ul className="sv-cards" aria-busy="true">
                                {[0, 1, 2].map((i) => (
                                    <li key={i} className="sv-card sv-card--skeleton" />
                                ))}
                            </ul>
                        ) : pois.length === 0 ? (
                            <div className="sv-empty">
                                <MapPinIcon size={32} />
                                <p>Không tìm thấy địa điểm nào.</p>
                            </div>
                        ) : (
                            <>
                                <ul className="sv-cards">
                                    {pois.map((item) => (
                                        <li key={item.id} className="sv-card">
                                            <button
                                                type="button"
                                                className="sv-card__main"
                                                onClick={() => openDetail(item)}
                                                style={{ padding: "10px 12px" }}
                                            >
                                                <div className="sv-card__body">
                                                    <div className="sv-card__top">
                                                        <strong>{item.name || "Không tên"}</strong>
                                                        <span
                                                            className={`sv-badge ${item.source === "user" ? "sv-badge--ok" : "sv-badge--info"}`}
                                                        >
                                                            {item.source === "user" ? "User" : "OSM"}
                                                        </span>
                                                    </div>
                                                    <span className="sv-card__meta">
                                                        📁 {item.category} {item.address ? `• ${item.address}` : ""}
                                                    </span>
                                                    <span className="sv-card__meta sv-card__meta--mono">
                                                        {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                                                    </span>
                                                </div>
                                            </button>

                                            <div className="sv-card__actions">
                                                <button
                                                    type="button"
                                                    className="sv-btn sv-btn--ghost"
                                                    onClick={() => onGoToPoi(item)}
                                                >
                                                    <MapPinIcon size={14} /> Đến
                                                </button>
                                                {tab === "user" && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="sv-btn sv-btn--ghost"
                                                            onClick={() => beginEdit(item)}
                                                        >
                                                            <EditIcon /> Sửa
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="sv-btn sv-btn--ghost sv-btn--danger-text"
                                                            onClick={() => setConfirmDeleteId(item.id)}
                                                        >
                                                            <TrashIcon /> Xóa
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {confirmDeleteId === item.id && (
                                                <div className="sv-confirm">
                                                    <span>Xóa POI này?</span>
                                                    <button
                                                        type="button"
                                                        className="sv-btn sv-btn--danger"
                                                        disabled={busy}
                                                        onClick={() => handleDelete(item)}
                                                    >
                                                        {busy ? "Đang xóa..." : "Xóa"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sv-btn"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>

                                {hasMore && (
                                    <button
                                        type="button"
                                        className="sv-btn sv-load-more"
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? "Đang tải thêm..." : `Tải thêm (còn ${total - pois.length} địa điểm)`}
                                    </button>
                                )}
                            </>
                        )}
                    </section>
                </div>
            )}
        </aside>
    );
}

const svg = (size = 18) => ({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
});

const CloseIcon = () => <svg {...svg()}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const BackIcon = () => <svg {...svg()}><path d="m15 18-6-6 6-6" /></svg>;
const SearchIcon = () => <svg {...svg(16)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
const EditIcon = () => <svg {...svg(14)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const TrashIcon = () => <svg {...svg(14)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
const AlertIcon = () => <svg {...svg(16)}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>;
const MapPinIcon = ({ size = 18 }: { size?: number }) => <svg {...svg(size)}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
const RefreshIcon = ({ spinning }: { spinning?: boolean }) => <svg {...svg()} className={spinning ? "sv-spin" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>;