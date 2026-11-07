// StreetViewManagementPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
    deleteStreetViewImage,
    fetchStreetViewImages,
    updateStreetViewImage,
} from "../../../api/streetview";
import type { StreetViewImage } from "../../../api/streetview";
import "./StreetViewManagementPanel.css";

interface Props {
    onClose: () => void;
    onChanged: () => void;
    isRecordingLocation: boolean;
    onStartLocationRecording: (cb: (loc: { lng: number; lat: number }) => void) => void;
    onStopLocationRecording: () => void;
    /** Bay tới vị trí ảnh trên bản đồ (và/hoặc mở viewer 360°). */
    onGoToImage: (image: StreetViewImage) => void;
}

interface ImageDraft {
    heading: string;
    lng: string;
    lat: string;
    captured_at: string; // giá trị cho <input type="datetime-local">
}
type LinkFilter = "all" | "linked" | "isolated";

const PAGE_SIZE = 50;
const EMPTY_DRAFT: ImageDraft = { heading: "", lng: "", lat: "", captured_at: "" };
const COMPASS = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDraft(img: StreetViewImage): ImageDraft {
    return {
        heading: img.heading == null ? "" : String(img.heading),
        lng: String(img.lng),
        lat: String(img.lat),
        captured_at: toLocalInput(img.captured_at),
    };
}

function headingLabel(h: number | null): string {
    if (h == null) return "Chưa có hướng";
    return `${Math.round(h)}° · ${COMPASS[Math.round(h / 45) % 8]}`;
}

function formatDate(iso: string | null): string {
    if (!iso) return "Không rõ";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "Không rõ" : d.toLocaleString("vi-VN");
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra");

export function StreetViewManagementPanel({
    onClose,
    onChanged,
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    onGoToImage,
}: Props) {
    const [images, setImages] = useState<StreetViewImage[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filter, setFilter] = useState<LinkFilter>("all");
    const [apiKey, setApiKey] = useState("");
    const [editing, setEditing] = useState<StreetViewImage | null>(null);
    const [draft, setDraft] = useState<ImageDraft>(EMPTY_DRAFT);
    const [selected, setSelected] = useState<StreetViewImage | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const requestSeq = useRef(0); // bỏ qua response cũ khi search đổi nhanh

    // Panel bị unmount (bấm lại icon ActivityBar, đóng panel...) khi đang ghi vị trí
    // -> tắt chế độ ghi để map không kẹt ở trạng thái "chờ click".
    const recordingRef = useRef(isRecordingLocation);
    const stopRecordingRef = useRef(onStopLocationRecording);
    recordingRef.current = isRecordingLocation;
    stopRecordingRef.current = onStopLocationRecording;
    useEffect(
        () => () => {
            if (recordingRef.current) stopRecordingRef.current();
        },
        [],
    );

    // ---------- load ----------
    const loadPage = useCallback(
        async (offset: number) => {
            const seq = ++requestSeq.current;
            try {
                const res = await fetchStreetViewImages({
                    search: debouncedSearch,
                    limit: PAGE_SIZE,
                    offset,
                });
                if (seq !== requestSeq.current) return;
                setImages((cur) => {
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
        },
        [debouncedSearch],
    );

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setLoading(true);
        void loadPage(0);
    }, [loadPage]);

    // ---------- derived ----------
    const stats = useMemo(() => {
        const linked = images.filter((i) => i.next_ids.length > 0).length;
        return { total, linked, isolated: images.length - linked };
    }, [images, total]);

    const visibleImages = useMemo(
        () =>
            images.filter((i) =>
                filter === "all" ? true : filter === "linked" ? i.next_ids.length > 0 : i.next_ids.length === 0,
            ),
        [images, filter],
    );

    const hasMore = images.length < total;

    // ---------- draft helpers ----------
    const updateDraft = <K extends keyof ImageDraft>(k: K, v: ImageDraft[K]) =>
        setDraft((c) => ({ ...c, [k]: v }));

    const stopLocationRecording = () => {
        if (isRecordingLocation) onStopLocationRecording();
    };

    const toggleLocationRecording = () => {
        if (isRecordingLocation) {
            onStopLocationRecording();
            return;
        }
        onStartLocationRecording(({ lng, lat }) =>
            setDraft((c) => ({ ...c, lng: String(lng), lat: String(lat) })),
        );
    };

    // ---------- form open/close ----------
    const beginEdit = (img: StreetViewImage) => {
        stopLocationRecording();
        setSelected(null);
        setConfirmDeleteId(null);
        setEditing(img);
        setDraft(toDraft(img));
        setError(null);
    };

    const closeForm = () => {
        stopLocationRecording();
        setEditing(null);
        setDraft(EMPTY_DRAFT);
        setError(null);
    };

    useEffect(() => {
        if (editing) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [editing]);

    // ---------- handlers ----------
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await loadPage(0);
    };

    const handleLoadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        void loadPage(images.length);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        if (!apiKey.trim()) return setError("Nhập API key để lưu thay đổi");

        const lng = Number(draft.lng);
        const lat = Number(draft.lat);
        if (!draft.lng.trim() || !draft.lat.trim() || !Number.isFinite(lng) || !Number.isFinite(lat))
            return setError("Kinh độ và vĩ độ phải là số");
        if (lng < -180 || lng > 180) return setError("Kinh độ phải trong khoảng -180 đến 180");
        if (lat < -90 || lat > 90) return setError("Vĩ độ phải trong khoảng -90 đến 90");

        let heading: number | null = null;
        if (draft.heading.trim()) {
            heading = Number(draft.heading);
            if (!Number.isFinite(heading) || heading < 0 || heading >= 360)
                return setError("Hướng phải trong khoảng 0 đến dưới 360°");
        }

        let captured_at: string | null = null;
        if (draft.captured_at) {
            const d = new Date(draft.captured_at);
            if (Number.isNaN(d.getTime())) return setError("Thời gian chụp không hợp lệ");
            captured_at = d.toISOString();
        }

        setBusy(true);
        setError(null);
        try {
            await updateStreetViewImage(editing.id, { heading, lng, lat, captured_at }, apiKey.trim());
            closeForm();
            await loadPage(0);
            onChanged();
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (img: StreetViewImage) => {
        if (!apiKey.trim()) {
            setConfirmDeleteId(null);
            return setError("Nhập API key để xóa ảnh");
        }
        setBusy(true);
        setError(null);
        try {
            await deleteStreetViewImage(img.id, apiKey.trim());
            if (editing?.id === img.id) closeForm();
            await loadPage(0);
            onChanged();
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setBusy(false);
            setConfirmDeleteId(null);
            setSelected((cur) => (cur?.id === img.id ? null : cur));
        }
    };

    const hasLocation = Boolean(draft.lng.trim() && draft.lat.trim());
    const locationLabel = hasLocation
        ? `${Number(draft.lat).toFixed(5)}, ${Number(draft.lng).toFixed(5)}`
        : "Ghi nhận vị trí trên bản đồ";

    // ---------- render ----------
    return (
        <aside className="coord-sidebar sv-management sv-dashboard" aria-label="Quản lý Street View">
            <header className="sv-dashboard__header">
                {selected ? (
                    <>
                        <button type="button" className="sv-icon-btn" onClick={() => setSelected(null)} aria-label="Quay lại">
                            <BackIcon />
                        </button>
                        <div className="sv-dashboard__title">
                            <strong>Ảnh #{selected.id}</strong>
                            <span>Chi tiết</span>
                        </div>
                        <button type="button" className="sv-icon-btn" onClick={onClose} aria-label="Đóng">
                            <CloseIcon />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="sv-dashboard__title">
                            <strong>Quản lý Street View</strong>
                            <span>Ảnh 360° trên bản đồ</span>
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
                )}
            </header>

            {selected ? (
                <ImageDetailView
                    image={selected}
                    confirmDelete={confirmDeleteId === selected.id}
                    busy={busy}
                    error={error}
                    onGoToImage={onGoToImage}
                    onEdit={() => beginEdit(selected)}
                    onRequestDelete={() => setConfirmDeleteId(selected.id)}
                    onConfirmDelete={() => handleDelete(selected)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                />
            ) : (
                <div className="coord-sidebar__scroll sv-dashboard__scroll">
                    <div className="sv-stats" title="Số liệu liên kết tính trên các ảnh đã tải">
                        <div className="sv-stat">
                            <span className="sv-stat__value">{stats.total}</span>
                            <span className="sv-stat__label">Tổng ảnh</span>
                        </div>
                        <div className="sv-stat sv-stat--ok">
                            <span className="sv-stat__value">{stats.linked}</span>
                            <span className="sv-stat__label">Có liên kết</span>
                        </div>
                        <div className="sv-stat sv-stat--warn">
                            <span className="sv-stat__value">{stats.isolated}</span>
                            <span className="sv-stat__label">Chưa liên kết</span>
                        </div>
                    </div>

                    <label className="sv-field">
                        <span>API key (để sửa / xóa)</span>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="X-API-Key"
                            autoComplete="off"
                        />
                    </label>

                    {editing && (
                        <form ref={formRef} className="sv-form" onSubmit={handleSubmit}>
                            <h3 className="sv-form__title">Sửa ảnh #{editing.id}</h3>

                            <button
                                type="button"
                                className={`sv-location-btn${isRecordingLocation ? " is-recording" : ""}${hasLocation ? " has-value" : ""}`}
                                onClick={toggleLocationRecording}
                            >
                                <MapPinIcon size={16} />
                                <span>{isRecordingLocation ? "Bấm lên bản đồ để chọn vị trí… (bấm để hủy)" : locationLabel}</span>
                            </button>

                            <div className="sv-form__row">
                                <label className="sv-field">
                                    <span>Kinh độ</span>
                                    <input
                                        inputMode="decimal"
                                        value={draft.lng}
                                        onChange={(e) => updateDraft("lng", e.target.value)}
                                    />
                                </label>
                                <label className="sv-field">
                                    <span>Vĩ độ</span>
                                    <input
                                        inputMode="decimal"
                                        value={draft.lat}
                                        onChange={(e) => updateDraft("lat", e.target.value)}
                                    />
                                </label>
                            </div>

                            <label className="sv-field">
                                <span>Hướng (0–359°, để trống = không rõ)</span>
                                <input
                                    inputMode="decimal"
                                    value={draft.heading}
                                    onChange={(e) => updateDraft("heading", e.target.value)}
                                    placeholder="VD: 90"
                                />
                            </label>

                            <label className="sv-field">
                                <span>Thời gian chụp</span>
                                <input
                                    type="datetime-local"
                                    value={draft.captured_at}
                                    onChange={(e) => updateDraft("captured_at", e.target.value)}
                                />
                            </label>

                            <div className="sv-form__actions">
                                <button type="submit" className="sv-btn sv-btn--primary" disabled={busy}>
                                    {busy ? "Đang lưu…" : "Lưu thay đổi"}
                                </button>
                                <button type="button" className="sv-btn" onClick={closeForm} disabled={busy}>
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
                                Danh sách <span className="sv-count">{visibleImages.length}/{total}</span>
                            </h3>
                            <div className="sv-chips" role="group" aria-label="Lọc theo liên kết">
                                <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Tất cả" count={images.length} />
                                <FilterChip active={filter === "linked"} onClick={() => setFilter("linked")} label="Có liên kết" count={stats.linked} />
                                <FilterChip active={filter === "isolated"} onClick={() => setFilter("isolated")} label="Chưa liên kết" count={stats.isolated} />
                            </div>
                            <label className="sv-search">
                                <SearchIcon />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Tìm theo ID hoặc đường dẫn ảnh…"
                                />
                            </label>
                        </div>

                        {loading ? (
                            <ul className="sv-cards" aria-busy="true">
                                {[0, 1, 2].map((i) => (
                                    <li key={i} className="sv-card sv-card--skeleton" />
                                ))}
                            </ul>
                        ) : visibleImages.length === 0 ? (
                            <div className="sv-empty">
                                <PanoIcon size={32} />
                                <p>{debouncedSearch || filter !== "all" ? "Không có ảnh phù hợp." : "Chưa có ảnh Street View nào."}</p>
                            </div>
                        ) : (
                            <>
                                <ul className="sv-cards">
                                    {visibleImages.map((img) => (
                                        <li key={img.id} className="sv-card">
                                            <button type="button" className="sv-card__main" onClick={() => setSelected(img)}>
                                                <Thumb src={img.image_url} />
                                                <div className="sv-card__body">
                                                    <div className="sv-card__top">
                                                        <strong>#{img.id}</strong>
                                                        <span className={`sv-badge ${img.next_ids.length ? "sv-badge--ok" : "sv-badge--warn"}`}>
                                                            {img.next_ids.length ? `${img.next_ids.length} liên kết` : "Chưa liên kết"}
                                                        </span>
                                                    </div>
                                                    <span className="sv-card__meta">{headingLabel(img.heading)}</span>
                                                    <span className="sv-card__meta sv-card__meta--mono">
                                                        {img.lat.toFixed(5)}, {img.lng.toFixed(5)}
                                                    </span>
                                                </div>
                                            </button>

                                            {confirmDeleteId === img.id ? (
                                                <div className="sv-confirm">
                                                    <span>Xóa ảnh #{img.id}?</span>
                                                    <button type="button" className="sv-btn sv-btn--danger" disabled={busy} onClick={() => handleDelete(img)}>
                                                        {busy ? "Đang xóa…" : "Xóa"}
                                                    </button>
                                                    <button type="button" className="sv-btn" disabled={busy} onClick={() => setConfirmDeleteId(null)}>
                                                        Hủy
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="sv-card__actions">
                                                    <button type="button" className="sv-btn sv-btn--ghost" onClick={() => onGoToImage(img)}>
                                                        <MapPinIcon size={14} /> Đến
                                                    </button>
                                                    <button type="button" className="sv-btn sv-btn--ghost" onClick={() => beginEdit(img)}>
                                                        <EditIcon /> Sửa
                                                    </button>
                                                    <button type="button" className="sv-btn sv-btn--ghost sv-btn--danger-text" onClick={() => setConfirmDeleteId(img.id)}>
                                                        <TrashIcon /> Xóa
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>

                                {hasMore && (
                                    <button type="button" className="sv-btn sv-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                                        {loadingMore ? "Đang tải…" : `Tải thêm (còn ${total - images.length})`}
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

// ───────────────────────── sub-components ─────────────────────────

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
    return (
        <button type="button" className={`sv-chip${active ? " is-active" : ""}`} onClick={onClick} aria-pressed={active}>
            {label} <span>{count}</span>
        </button>
    );
}

function Thumb({ src }: { src: string }) {
    const [failed, setFailed] = useState(false);
    return (
        <div className="sv-thumb">
            {failed ? (
                <PanoIcon size={22} />
            ) : (
                <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
            )}
        </div>
    );
}

interface DetailProps {
    image: StreetViewImage;
    confirmDelete: boolean;
    busy: boolean;
    error: string | null;
    onGoToImage: (image: StreetViewImage) => void;
    onEdit: () => void;
    onRequestDelete: () => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
}

function ImageDetailView({
    image,
    confirmDelete,
    busy,
    error,
    onGoToImage,
    onEdit,
    onRequestDelete,
    onConfirmDelete,
    onCancelDelete,
}: DetailProps) {
    const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(`${image.lat}, ${image.lng}`);
            setCopyState("ok");
        } catch {
            setCopyState("fail");
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopyState("idle"), 2000);
    };

    return (
        <div className="coord-sidebar__scroll sv-dashboard__scroll">
            <div className="sv-detail-preview">
                <Thumb src={image.image_url} />
            </div>

            <div className="sv-panel-card">
                <div className="sv-panel-card__head">
                    <span className="sv-panel-card__label">Thông tin</span>
                    <span className={`sv-badge ${image.next_ids.length ? "sv-badge--ok" : "sv-badge--warn"}`}>
                        {image.next_ids.length ? "Có liên kết" : "Chưa liên kết"}
                    </span>
                </div>
                <dl className="sv-dl">
                    <dt>ID</dt>
                    <dd>#{image.id}</dd>
                    <dt>Hướng</dt>
                    <dd>{headingLabel(image.heading)}</dd>
                    <dt>Thời gian chụp</dt>
                    <dd>{formatDate(image.captured_at)}</dd>
                    <dt>Tệp ảnh</dt>
                    <dd className="sv-dl__break">{image.image_url}</dd>
                </dl>
            </div>

            <div className="sv-panel-card">
                <div className="sv-panel-card__head">
                    <span className="sv-panel-card__label">Vị trí</span>
                    <button type="button" className="sv-btn sv-btn--ghost" onClick={handleCopy}>
                        {copyState === "ok" ? "Đã chép" : copyState === "fail" ? "Không chép được" : "Sao chép"}
                    </button>
                </div>
                <div className="sv-coords">
                    <div><small>LAT</small><code>{image.lat.toFixed(6)}</code></div>
                    <div><small>LNG</small><code>{image.lng.toFixed(6)}</code></div>
                </div>
                <button type="button" className="sv-btn sv-btn--primary sv-btn--block" onClick={() => onGoToImage(image)}>
                    <MapPinIcon size={16} /> Đến vị trí
                </button>
            </div>

            <div className="sv-panel-card">
                <div className="sv-panel-card__head">
                    <span className="sv-panel-card__label">Liên kết tới ảnh khác</span>
                </div>
                {image.next_ids.length === 0 ? (
                    <p className="sv-muted">Chưa có liên kết nào.</p>
                ) : (
                    <ul className="sv-links">
                        {image.next_ids.map((id, i) => {
                            const pos = image.link_positions[i];
                            return (
                                <li key={`${id}-${i}`}>
                                    <strong>→ #{id}</strong>
                                    <span>{pos ? `texture (${pos.textureX}, ${pos.textureY})` : "chưa có vị trí"}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {error && (
                <div className="sv-alert" role="alert">
                    <AlertIcon />
                    <span>{error}</span>
                </div>
            )}

            {confirmDelete ? (
                <div className="sv-confirm sv-confirm--bar">
                    <span>Xóa ảnh này? Các liên kết trỏ tới nó sẽ bị gỡ.</span>
                    <button type="button" className="sv-btn sv-btn--danger" disabled={busy} onClick={onConfirmDelete}>
                        {busy ? "Đang xóa…" : "Xóa"}
                    </button>
                    <button type="button" className="sv-btn" disabled={busy} onClick={onCancelDelete}>
                        Hủy
                    </button>
                </div>
            ) : (
                <div className="sv-detail-actions">
                    <button type="button" className="sv-btn" onClick={onEdit}>
                        <EditIcon /> Sửa
                    </button>
                    <button type="button" className="sv-btn sv-btn--danger-outline" onClick={onRequestDelete}>
                        <TrashIcon /> Xóa
                    </button>
                </div>
            )}
        </div>
    );
}

// ───────────────────────── icons ─────────────────────────

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
const EditIcon = () => <svg {...svg(14)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const TrashIcon = () => <svg {...svg(14)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
const AlertIcon = () => <svg {...svg(16)}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>;
const MapPinIcon = ({ size = 18 }: { size?: number }) => <svg {...svg(size)}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
const PanoIcon = ({ size = 18 }: { size?: number }) => <svg {...svg(size)}><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></svg>;
const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg {...svg()} className={spinning ? "sv-spin" : undefined}>
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
    </svg>
);