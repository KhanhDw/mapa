
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_API_KEY } from "../../../api/streetview";
import {
    deleteUserPoi,
    fetchSystemPois,
    fetchUserPois,
    updateUserPoi,
} from "../../../api/pois";
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

interface PoiDraft {
    name: string;
    category: string;
    address: string;
    lng: string;
    lat: string;
}

const PAGE_SIZE = 50;
const errMsg = (e: unknown) =>
    e instanceof Error ? e.message : "Đã có lỗi xảy ra";

const EMPTY_DRAFT: PoiDraft = {
    name: "",
    category: "",
    address: "",
    lng: "",
    lat: "",
};

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
    const [editing, setEditing] = useState<PoiItem | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] =
        useState<number | string | null>(null);
    const [draft, setDraft] = useState<PoiDraft>(EMPTY_DRAFT);

    const requestSeq = useRef(0);
    const recordingRef = useRef(isRecordingLocation);
    const stopRecordingRef = useRef(onStopLocationRecording);

    recordingRef.current = isRecordingLocation;
    stopRecordingRef.current = onStopLocationRecording;

    useEffect(() => {
        return () => {
            if (recordingRef.current) stopRecordingRef.current();
        };
    }, []);

    // Debounce tìm kiếm
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search]);

    // Tải dữ liệu theo nguồn và từ khóa
    const loadPage = useCallback(
        async (offset = 0, append = false) => {
            const seq = ++requestSeq.current;

            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            try {
                const params = {
                    search: debouncedSearch,
                    limit: PAGE_SIZE,
                    offset,
                };

                const res =
                    tab === "user"
                        ? await fetchUserPois(params)
                        : await fetchSystemPois(params);

                if (seq !== requestSeq.current) return;

                setPois((current) => {
                    if (!append) return res.items;

                    const seen = new Set(current.map((item) => item.id));
                    return [
                        ...current,
                        ...res.items.filter((item) => !seen.has(item.id)),
                    ];
                });

                setTotal(res.total);
                setError(null);
            } catch (err) {
                if (seq === requestSeq.current) {
                    setError(errMsg(err));
                }
            } finally {
                if (seq === requestSeq.current) {
                    setLoading(false);
                    setLoadingMore(false);
                    setRefreshing(false);
                }
            }
        },
        [tab, debouncedSearch]
    );

    useEffect(() => {
        void loadPage(0);
    }, [loadPage]);

    const hasMore = pois.length < total;

    const stopLocationRecording = useCallback(() => {
        if (isRecordingLocation) onStopLocationRecording();
    }, [isRecordingLocation, onStopLocationRecording]);

    const applyLocation = useCallback(
        ({ lng, lat }: { lng: number; lat: number }) => {
            setDraft((current) => ({
                ...current,
                lng: String(lng),
                lat: String(lat),
            }));
        },
        []
    );

    const toggleLocationRecording = () => {
        if (isRecordingLocation) {
            onStopLocationRecording();
        } else {
            onStartLocationRecording(applyLocation);
        }
    };

    const closeEditForm = () => {
        stopLocationRecording();
        setEditing(null);
        setDraft(EMPTY_DRAFT);
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
            category: item.category || "",
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
        setConfirmDeleteId(null);
        setError(null);
    };

    const handleBack = () => {
        setSelected(null);
        setMode("list");
        setError(null);
    };

    const handleTabChange = (nextTab: SourceTab) => {
        if (nextTab === tab) return;

        stopLocationRecording();
        setTab(nextTab);
        setSearch("");
        setDebouncedSearch("");
        setEditing(null);
        setSelected(null);
        setConfirmDeleteId(null);
        setMode("list");
        setError(null);
    };

    const handleRefresh = async () => {
        if (refreshing || loading) return;

        setRefreshing(true);
        await loadPage(0);
    };

    const handleLoadMore = () => {
        if (loadingMore || loading || !hasMore) return;
        void loadPage(pois.length, true);
    };

    const handleSubmitEdit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!editing || busy) return;

        if (!apiKey.trim()) {
            setApiKeyError(true);
            setError("Vui lòng nhập API key để lưu thay đổi.");
            return;
        }

        const lng = Number(draft.lng.trim().replace(",", "."));
        const lat = Number(draft.lat.trim().replace(",", "."));

        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            setError("Kinh độ phải nằm trong khoảng -180 đến 180.");
            return;
        }

        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            setError("Vĩ độ phải nằm trong khoảng -90 đến 90.");
            return;
        }

        if (!draft.name.trim() || !draft.category.trim()) {
            setError("Vui lòng nhập tên địa điểm và danh mục.");
            return;
        }

        setApiKeyError(false);
        setBusy(true);
        setError(null);

        try {
            await updateUserPoi(
                editing.id,
                {
                    name: draft.name.trim(),
                    category: draft.category.trim(),
                    address: draft.address.trim(),
                    lng,
                    lat,
                },
                apiKey.trim()
            );

            closeEditForm();
            await loadPage(0);
            onChanged();
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
            setError("Vui lòng nhập API key để xóa địa điểm.");
            return;
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

            setConfirmDeleteId(null);
            await loadPage(0);
            onChanged();
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setBusy(false);
        }
    };

    const hasEditLocation = Boolean(draft.lng.trim() && draft.lat.trim());

    return (
        <aside
            className="coord-sidebar sv-management sv-dashboard poi-dashboard"
            aria-label="Quản lý địa điểm POI"
        >
            <header className="sv-dashboard__header poi-header">
                {mode === "detail" && selected ? (
                    <>
                        <button
                            type="button"
                            className="sv-icon-btn"
                            onClick={handleBack}
                            aria-label="Quay lại"
                        >
                            <BackIcon />
                        </button>

                        <div className="sv-dashboard__title">
                            <strong>{selected.name || "Không tên"}</strong>
                            <span>Thông tin địa điểm · #{selected.id}</span>
                        </div>

                        <button
                            type="button"
                            className="sv-icon-btn"
                            onClick={onClose}
                            aria-label="Đóng"
                        >
                            <CloseIcon />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="poi-header__identity">
                            <div className="poi-header__icon">
                                <MapPinIcon size={19} />
                            </div>
                            <div className="sv-dashboard__title">
                                <strong>Quản lý địa điểm</strong>
                                <span>POI Management</span>
                            </div>
                        </div>

                        <div className="sv-dashboard__header-actions">
                            <button
                                type="button"
                                className={`sv-icon-btn ${refreshing ? "is-loading" : ""}`}
                                onClick={handleRefresh}
                                disabled={refreshing || loading}
                                aria-label="Tải lại dữ liệu"
                                title="Tải lại"
                            >
                                <RefreshIcon spinning={refreshing} />
                            </button>
                            <button
                                type="button"
                                className="sv-icon-btn"
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

            {mode === "detail" && selected ? (
                <div className="coord-sidebar__scroll sv-dashboard__scroll poi-content">
                    <section className="poi-detail-hero">
                        <div className="poi-detail-hero__icon">
                            <MapPinIcon size={25} />
                        </div>
                        <div className="poi-detail-hero__content">
                            <span className="poi-eyebrow">ĐỊA ĐIỂM POI</span>
                            <h2>{selected.name || "Không tên"}</h2>
                            <span
                                className={`sv-badge ${selected.source === "user"
                                    ? "sv-badge--ok"
                                    : "sv-badge--info"
                                    }`}
                            >
                                {selected.source === "user"
                                    ? "Người dùng đóng góp"
                                    : "Dữ liệu hệ thống OSM"}
                            </span>
                        </div>
                    </section>

                    <section className="sv-panel-card poi-info-card">
                        <div className="sv-panel-card__head">
                            <span className="sv-panel-card__label">
                                Thông tin chung
                            </span>
                        </div>

                        <dl className="sv-dl">
                            <dt>Tên địa điểm</dt>
                            <dd><strong>{selected.name || "Không tên"}</strong></dd>
                            <dt>Danh mục</dt>
                            <dd>{selected.category || "Chưa phân loại"}</dd>
                            <dt>Địa chỉ</dt>
                            <dd>{selected.address || "Chưa cập nhật"}</dd>
                            <dt>Mã POI</dt>
                            <dd><code>#{selected.id}</code></dd>
                        </dl>
                    </section>

                    <section className="sv-panel-card">
                        <div className="sv-panel-card__head">
                            <span className="sv-panel-card__label">
                                Vị trí địa lý
                            </span>
                            <span className="poi-coordinate-tag">WGS 84</span>
                        </div>

                        <div className="sv-coords">
                            <div>
                                <small>LATITUDE · VĨ ĐỘ</small>
                                <code>{selected.lat.toFixed(6)}</code>
                            </div>
                            <div>
                                <small>LONGITUDE · KINH ĐỘ</small>
                                <code>{selected.lng.toFixed(6)}</code>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="sv-btn sv-btn--primary sv-btn--block poi-map-action"
                            onClick={() => onGoToPoi(selected)}
                        >
                            <MapPinIcon size={16} />
                            Bay đến vị trí trên bản đồ
                        </button>
                    </section>

                    {selected.source === "user" && (
                        <section className="poi-detail-management">
                            <div className="poi-section-heading">
                                <strong>Quản lý địa điểm</strong>
                                <span>Chỉnh sửa hoặc xóa dữ liệu đã đóng góp.</span>
                            </div>

                            <div className="sv-detail-actions">
                                <button
                                    type="button"
                                    className="sv-btn"
                                    onClick={() => beginEdit(selected)}
                                >
                                    <EditIcon />
                                    Sửa thông tin
                                </button>
                                <button
                                    type="button"
                                    className="sv-btn sv-btn--danger-outline"
                                    onClick={() => setConfirmDeleteId(selected.id)}
                                >
                                    <TrashIcon />
                                    Xóa địa điểm
                                </button>
                            </div>

                            {confirmDeleteId === selected.id && (
                                <div className="sv-confirm sv-confirm--bar">
                                    <span>
                                        Bạn chắc chắn muốn xóa địa điểm này?
                                        Thao tác không thể hoàn tác.
                                    </span>
                                    <button
                                        type="button"
                                        className="sv-btn sv-btn--danger"
                                        disabled={busy}
                                        onClick={() => handleDelete(selected)}
                                    >
                                        {busy ? "Đang xóa..." : "Xác nhận xóa"}
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
                        </section>
                    )}
                </div>
            ) : (
                <div className="coord-sidebar__scroll sv-dashboard__scroll poi-content">
                    <section className="poi-intro">
                        <div>
                            <span className="poi-eyebrow">DATA MANAGEMENT</span>
                            <h2>Danh sách địa điểm</h2>
                            <p>Quản lý dữ liệu POI trên bản đồ của bạn.</p>
                        </div>
                        <div className="poi-total">
                            <strong>{total.toLocaleString("vi-VN")}</strong>
                            <span>Tổng địa điểm</span>
                        </div>
                    </section>

                    <div className="poi-source-tabs" role="tablist" aria-label="Nguồn dữ liệu">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === "user"}
                            className={`poi-source-tab ${tab === "user" ? "is-active" : ""}`}
                            onClick={() => handleTabChange("user")}
                        >
                            <span className="poi-source-tab__icon"><UserIcon /></span>
                            <span>
                                <strong>Người dùng</strong>
                                <small>Dữ liệu đóng góp</small>
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === "system"}
                            className={`poi-source-tab ${tab === "system" ? "is-active" : ""}`}
                            onClick={() => handleTabChange("system")}
                        >
                            <span className="poi-source-tab__icon"><GlobeIcon /></span>
                            <span>
                                <strong>Hệ thống OSM</strong>
                                <small>Dữ liệu bản đồ</small>
                            </span>
                        </button>
                    </div>

                    {tab === "user" && (
                        <section className="poi-api-panel">
                            <label className="sv-field">
                                <span>API KEY QUẢN TRỊ</span>
                                <input
                                    type="password"
                                    className={apiKeyError ? "sv-input-error" : ""}
                                    value={apiKey}
                                    onChange={(event) => {
                                        setApiKey(event.target.value);
                                        setApiKeyError(false);
                                    }}
                                    placeholder="Nhập X-API-Key"
                                    autoComplete="off"
                                />
                            </label>
                            <span className="poi-api-hint">
                                <LockIcon />
                                Dùng để xác thực thao tác sửa và xóa POI.
                            </span>
                        </section>
                    )}

                    {editing && (
                        <form className="sv-form poi-edit-form" onSubmit={handleSubmitEdit}>
                            <div className="poi-form-heading">
                                <div>
                                    <span className="poi-eyebrow">EDIT RECORD</span>
                                    <h3>Chỉnh sửa POI</h3>
                                    <p>Mã địa điểm #{editing.id}</p>
                                </div>
                                <button
                                    type="button"
                                    className="sv-icon-btn"
                                    onClick={closeEditForm}
                                    aria-label="Đóng biểu mẫu"
                                >
                                    <CloseIcon />
                                </button>
                            </div>

                            <button
                                type="button"
                                className={`sv-location-btn${isRecordingLocation ? " is-recording" : ""}${hasEditLocation ? " has-value" : ""}`}
                                onClick={toggleLocationRecording}
                            >
                                <MapPinIcon size={17} />
                                <span>
                                    {isRecordingLocation
                                        ? "Đang chọn vị trí trên bản đồ · Bấm để hủy"
                                        : "Chọn tọa độ trực tiếp trên bản đồ"}
                                </span>
                            </button>

                            <label className="sv-field">
                                <span>Tên địa điểm <b>*</b></span>
                                <input
                                    value={draft.name}
                                    onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
                                    placeholder="Nhập tên địa điểm"
                                    required
                                />
                            </label>

                            <label className="sv-field">
                                <span>Danh mục <b>*</b></span>
                                <input
                                    value={draft.category}
                                    onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value }))}
                                    placeholder="Ví dụ: restaurant, school..."
                                    required
                                />
                            </label>

                            <label className="sv-field">
                                <span>Địa chỉ</span>
                                <input
                                    value={draft.address}
                                    onChange={(e) => setDraft((c) => ({ ...c, address: e.target.value }))}
                                    placeholder="Nhập địa chỉ"
                                />
                            </label>

                            <div className="sv-form__row">
                                <label className="sv-field">
                                    <span>Kinh độ (Lng)</span>
                                    <input
                                        inputMode="decimal"
                                        value={draft.lng}
                                        onChange={(e) => setDraft((c) => ({ ...c, lng: e.target.value }))}
                                        placeholder="105.000000"
                                    />
                                </label>
                                <label className="sv-field">
                                    <span>Vĩ độ (Lat)</span>
                                    <input
                                        inputMode="decimal"
                                        value={draft.lat}
                                        onChange={(e) => setDraft((c) => ({ ...c, lat: e.target.value }))}
                                        placeholder="10.000000"
                                    />
                                </label>
                            </div>

                            <div className="poi-form-coordinate">
                                <MapPinIcon size={14} />
                                {hasEditLocation
                                    ? `${draft.lat}, ${draft.lng}`
                                    : "Chưa có tọa độ"}
                            </div>

                            <div className="sv-form__actions">
                                <button
                                    type="submit"
                                    className="sv-btn sv-btn--primary"
                                    disabled={busy}
                                >
                                    {busy ? <SpinnerIcon /> : <CheckIcon />}
                                    {busy ? "Đang lưu..." : "Lưu thay đổi"}
                                </button>
                                <button
                                    type="button"
                                    className="sv-btn"
                                    onClick={closeEditForm}
                                    disabled={busy}
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    )}

                    {error && (
                        <div className="sv-alert poi-alert" role="alert">
                            <AlertIcon />
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                aria-label="Đóng thông báo"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                    )}

                    <section className="sv-list poi-list">
                        <div className="poi-list-heading">
                            <div>
                                <h3>Địa điểm</h3>
                                <span>
                                    Hiển thị {pois.length.toLocaleString("vi-VN")} / {total.toLocaleString("vi-VN")} kết quả
                                </span>
                            </div>
                            <span className="poi-list-count">{total.toLocaleString("vi-VN")}</span>
                        </div>

                        <label className="sv-search poi-search">
                            <SearchIcon />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={
                                    tab === "user"
                                        ? "Tìm theo tên hoặc địa chỉ..."
                                        : "Tìm địa điểm OSM..."
                                }
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    aria-label="Xóa tìm kiếm"
                                >
                                    <CloseIcon />
                                </button>
                            )}
                        </label>

                        {loading ? (
                            <ul className="sv-cards" aria-busy="true" aria-label="Đang tải địa điểm">
                                {[0, 1, 2, 3].map((i) => (
                                    <li key={i} className="sv-card poi-skeleton">
                                        <div className="poi-skeleton__line poi-skeleton__line--title" />
                                        <div className="poi-skeleton__line" />
                                        <div className="poi-skeleton__line poi-skeleton__line--short" />
                                    </li>
                                ))}
                            </ul>
                        ) : pois.length === 0 ? (
                            <div className="sv-empty poi-empty">
                                <div className="poi-empty__icon"><MapPinIcon size={26} /></div>
                                <strong>Không tìm thấy địa điểm</strong>
                                <p>
                                    {search
                                        ? "Thử thay đổi từ khóa tìm kiếm."
                                        : "Nguồn dữ liệu này hiện chưa có POI."}
                                </p>
                                {search && (
                                    <button type="button" className="sv-btn" onClick={() => setSearch("")}>
                                        Xóa tìm kiếm
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <ul className="sv-cards poi-cards">
                                    {pois.map((item) => (
                                        <li key={item.id} className="sv-card poi-card">
                                            <button
                                                type="button"
                                                className="sv-card__main poi-card__main"
                                                onClick={() => openDetail(item)}
                                            >
                                                <span className="poi-card__marker">
                                                    <MapPinIcon size={18} />
                                                </span>
                                                <span className="sv-card__body">
                                                    <span className="sv-card__top">
                                                        <strong>{item.name || "Không tên"}</strong>
                                                        <span className={`sv-badge ${item.source === "user" ? "sv-badge--ok" : "sv-badge--info"}`}>
                                                            {item.source === "user" ? "USER" : "OSM"}
                                                        </span>
                                                    </span>
                                                    <span className="poi-card__category">
                                                        {item.category || "Chưa phân loại"}
                                                    </span>
                                                    {item.address && (
                                                        <span className="sv-card__meta">
                                                            {item.address}
                                                        </span>
                                                    )}
                                                    <span className="sv-card__meta sv-card__meta--mono">
                                                        {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                                                    </span>
                                                </span>
                                                <span className="poi-card__chevron"><ChevronIcon /></span>
                                            </button>

                                            <div className="sv-card__actions poi-card__actions">
                                                <button
                                                    type="button"
                                                    className="sv-btn sv-btn--ghost"
                                                    onClick={() => onGoToPoi(item)}
                                                >
                                                    <MapPinIcon size={14} /> Đến vị trí
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
                                                <div className="sv-confirm poi-confirm">
                                                    <span>Xác nhận xóa POI này?</span>
                                                    <button
                                                        type="button"
                                                        className="sv-btn sv-btn--danger"
                                                        disabled={busy}
                                                        onClick={() => handleDelete(item)}
                                                    >
                                                        {busy ? "Đang xóa..." : "Xác nhận"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sv-btn"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        disabled={busy}
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
                                        className="sv-btn sv-load-more poi-load-more"
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? (
                                            <>
                                                <SpinnerIcon />
                                                Đang tải thêm...
                                            </>
                                        ) : (
                                            `Tải thêm ${Math.min(PAGE_SIZE, total - pois.length)} địa điểm`
                                        )}
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

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const svg = (size = 18) => ({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
});

const CloseIcon = () => (
    <svg {...svg()}><path d="M18 6 6 18M6 6l12 12" /></svg>
);

const BackIcon = () => (
    <svg {...svg()}><path d="m15 18-6-6 6-6" /></svg>
);

const SearchIcon = () => (
    <svg {...svg(16)}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
    </svg>
);

const EditIcon = () => (
    <svg {...svg(14)}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
);

const TrashIcon = () => (
    <svg {...svg(14)}>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
);

const AlertIcon = () => (
    <svg {...svg(16)}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
    </svg>
);

const MapPinIcon = ({ size = 18 }: { size?: number }) => (
    <svg {...svg(size)}>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg {...svg()} className={spinning ? "sv-spin" : undefined}>
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);

const UserIcon = () => (
    <svg {...svg(17)}>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
);

const GlobeIcon = () => (
    <svg {...svg(17)}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
);

const LockIcon = () => (
    <svg {...svg(13)}>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
);

const CheckIcon = () => (
    <svg {...svg(16)}><path d="m5 12 4 4L19 6" /></svg>
);

const ChevronIcon = () => (
    <svg {...svg(16)}><path d="m9 18 6-6-6-6" /></svg>
);

const SpinnerIcon = () => (
    <svg {...svg(16)} className="poi-spinner">
        <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
);
