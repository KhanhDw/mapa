// StreetViewManagementPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
    deleteStreetViewImage,
    fetchStreetViewImages,
    updateStreetViewImage,
    uploadStreetViewImage,
} from "../../../api/streetview";
import type { StreetViewImage } from "../../../api/streetview";
import "./StreetViewManagementPanel.css";

interface Props {
    onClose: () => void;
    onChanged: () => void;
    isRecordingLocation: boolean;
    onStartLocationRecording: (cb: (loc: { lng: number; lat: number }) => void) => void;
    onStopLocationRecording: () => void;
    onGoToImage: (image: StreetViewImage) => void;
}

// ───────────── types ─────────────
interface ImageDraft {
    heading: string;
    lng: string;
    lat: string;
    captured_at: string;
}

interface NewPanoramaDraft {
    lng: string;
    lat: string;
    heading: string;
    file: File | null;
}

type LinkFilter = "all" | "linked" | "isolated";
type Mode = "list" | "create" | "detail";
type FileValidation = { ok: true } | { ok: false; msg: string } | null;

// ───────────── constants ─────────────
const PAGE_SIZE = 50;
const MAX_PANO_FILE_MB = 25;
const MAX_PANO_FILE_BYTES = MAX_PANO_FILE_MB * 1024 * 1024;
const PANO_RATIO_TOLERANCE = 0.05;

const EMPTY_DRAFT: ImageDraft = { heading: "", lng: "", lat: "", captured_at: "" };
const makeEmptyPanoDraft = (): NewPanoramaDraft => ({ lng: "", lat: "", heading: "", file: null });
const COMPASS = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];

// ───────────── helpers ─────────────
const pad = (n: number) => String(n).padStart(2, "0");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra");

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

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Trả về null nếu ảnh có tỷ lệ 2:1 (equirectangular), hoặc thông báo lỗi. */
function validatePanoramaRatio(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            URL.revokeObjectURL(url);
            if (!Number.isFinite(ratio) || Math.abs(ratio - 2) > PANO_RATIO_TOLERANCE) {
                resolve(
                    `Ảnh phải có tỷ lệ 2:1 (equirectangular). Hiện tại: ${img.naturalWidth}×${img.naturalHeight} (≈ ${ratio.toFixed(2)}:1).`,
                );
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve("Không đọc được tệp ảnh. Vui lòng chọn JPG / PNG / WebP hợp lệ.");
        };
        img.src = url;
    });
}

// ───────────── main component ─────────────
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
    const [apiKeyError, setApiKeyError] = useState(false);

    // mode/navigation
    const [mode, setMode] = useState<Mode>("list");
    const [selected, setSelected] = useState<StreetViewImage | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    // edit
    const [editing, setEditing] = useState<StreetViewImage | null>(null);
    const [draft, setDraft] = useState<ImageDraft>(EMPTY_DRAFT);

    // create
    const [panoDraft, setPanoDraft] = useState<NewPanoramaDraft>(makeEmptyPanoDraft);
    const [panoPreviewUrl, setPanoPreviewUrl] = useState<string | null>(null);
    const [fileValidation, setFileValidation] = useState<FileValidation>(null);
    const abortRef = useRef<AbortController | null>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const requestSeq = useRef(0);

    // Refs để cleanup an toàn khi unmount
    const recordingRef = useRef(isRecordingLocation);
    const stopRecordingRef = useRef(onStopLocationRecording);
    recordingRef.current = isRecordingLocation;
    stopRecordingRef.current = onStopLocationRecording;

    useEffect(
        () => () => {
            if (recordingRef.current) stopRecordingRef.current();
            abortRef.current?.abort();
        },
        [],
    );

    // Preview URL cho file panorama
    useEffect(() => {
        if (!panoDraft.file) {
            setPanoPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(panoDraft.file);
        setPanoPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [panoDraft.file]);

    // ───────── load ─────────
    const loadPage = useCallback(
        async (offset: number, isMore = false) => {
            const seq = ++requestSeq.current;
            if (!isMore) setLoading(true);
            try {
                const res = await fetchStreetViewImages({
                    search: debouncedSearch,
                    limit: PAGE_SIZE,
                    offset,
                });

                // Debug — bỏ khi ổn định
                console.log("[SV panel] loadPage response:", {
                    offset,
                    search: debouncedSearch,
                    itemsLen: res.items.length,
                    total: res.total,
                    ids: res.items.map((i) => i.id),
                });

                if (seq !== requestSeq.current) {
                    console.warn("[SV panel] stale response discarded", { seq, current: requestSeq.current });
                    return;
                }
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
        void loadPage(0);
    }, [loadPage]);

    // ───────── derived ─────────
    const stats = useMemo(() => {
        const linked = images.filter((i) => (i.next_ids?.length ?? 0) > 0).length;
        return { total, linked, isolated: images.length - linked };
    }, [images, total]);

    const visibleImages = useMemo(() => {
        const list = images.filter((i) => {
            const n = i.next_ids?.length ?? 0;
            if (filter === "all") return true;
            if (filter === "linked") return n > 0;
            return n === 0;
        });
        console.log("[SV panel] visibleImages:", {
            imagesLen: images.length,
            visibleLen: list.length,
            filter,
            search: debouncedSearch,
        });
        return list;
    }, [images, filter, debouncedSearch]);



    const hasMore = images.length < total;

    // ───────── draft helpers ─────────
    const updateDraft = <K extends keyof ImageDraft>(k: K, v: ImageDraft[K]) =>
        setDraft((c) => ({ ...c, [k]: v }));

    const stopLocationRecording = () => {
        if (isRecordingLocation) onStopLocationRecording();
    };

    const applyLocation = useCallback(
        ({ lng, lat }: { lng: number; lat: number }) => {
            if (mode === "create") {
                setPanoDraft((c) => ({ ...c, lng: String(lng), lat: String(lat) }));
            } else {
                setDraft((c) => ({ ...c, lng: String(lng), lat: String(lat) }));
            }
        },
        [mode],
    );

    const toggleLocationRecording = () => {
        if (isRecordingLocation) {
            onStopLocationRecording();
            return;
        }
        onStartLocationRecording(applyLocation);
    };

    // ───────── navigation ─────────
    const closeEditForm = () => {
        stopLocationRecording();
        setEditing(null);
        setDraft(EMPTY_DRAFT);
        setError(null);
    };

    const beginEdit = (img: StreetViewImage) => {
        stopLocationRecording();
        setSelected(null);
        setMode("list");
        setConfirmDeleteId(null);
        setEditing(img);
        setDraft(toDraft(img));
        setError(null);
    };

    const openDetail = (img: StreetViewImage) => {
        stopLocationRecording();
        setEditing(null);
        setDraft(EMPTY_DRAFT);
        setSelected(img);
        setMode("detail");
        setError(null);
    };

    const startCreate = () => {
        stopLocationRecording();
        setEditing(null);
        setSelected(null);
        setPanoDraft(makeEmptyPanoDraft());
        setFileValidation(null);
        setApiKeyError(false);
        setMode("create");
        setError(null);
    };

    const closeCreate = () => {
        stopLocationRecording();
        abortRef.current?.abort();
        setPanoDraft(makeEmptyPanoDraft());
        setFileValidation(null);
        setMode("list");
        setError(null);
    };

    const handleBack = () => {
        if (mode === "create") closeCreate();
        else {
            setSelected(null);
            setMode("list");
            setError(null);
        }
    };

    useEffect(() => {
        if (editing && mode === "list") formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [editing, mode]);

    // ───────── list handlers ─────────
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await loadPage(0);
    };

    const handleLoadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        void loadPage(images.length, true);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editing || busy) return;

        if (!apiKey.trim()) {
            setApiKeyError(true);
            return setError("Vui lòng nhập API key để lưu thay đổi");
        }
        setApiKeyError(false);

        const cleanLng = draft.lng.trim().replace(",", ".");
        const cleanLat = draft.lat.trim().replace(",", ".");
        const lng = Number(cleanLng);
        const lat = Number(cleanLat);

        if (!cleanLng || !cleanLat || !Number.isFinite(lng) || !Number.isFinite(lat))
            return setError("Kinh độ và vĩ độ phải là số hợp lệ");
        if (lng < -180 || lng > 180) return setError("Kinh độ phải trong khoảng -180 đến 180");
        if (lat < -90 || lat > 90) return setError("Vĩ độ phải trong khoảng -90 đến 90");

        let heading: number | null = null;
        if (draft.heading.trim()) {
            const raw = Number(draft.heading.trim().replace(",", "."));
            if (!Number.isFinite(raw) || raw < 0 || raw > 360)
                return setError("Hướng phải trong khoảng 0–360° (360° ≡ 0°)");
            heading = raw % 360;
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
            closeEditForm();
            await loadPage(0);
            onChanged();
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (img: StreetViewImage) => {
        if (busy) return;
        if (!apiKey.trim()) {
            setApiKeyError(true);
            setConfirmDeleteId(null);
            return setError("Vui lòng nhập API key để thực hiện xóa");
        }
        setApiKeyError(false);
        setBusy(true);
        setError(null);
        try {
            await deleteStreetViewImage(img.id, apiKey.trim());
            if (editing?.id === img.id) closeEditForm();
            if (selected?.id === img.id) {
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
            setSelected((cur) => (cur?.id === img.id ? null : cur));
        }
    };

    // ───────── create handlers ─────────
    const handleFileChange = async (file: File | null) => {
        setPanoDraft((c) => ({ ...c, file }));
        if (!file) {
            setFileValidation(null);
            return;
        }
        if (file.size > MAX_PANO_FILE_BYTES) {
            setFileValidation({ ok: false, msg: `Tệp vượt quá ${MAX_PANO_FILE_MB}MB.` });
            return;
        }
        const ratioErr = await validatePanoramaRatio(file);
        setFileValidation(ratioErr ? { ok: false, msg: ratioErr } : { ok: true });
    };

    const handleCreatePano = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;

        if (!apiKey.trim()) {
            setApiKeyError(true);
            return setError("Vui lòng nhập API key để tải lên ảnh mới");
        }
        setApiKeyError(false);

        if (!panoDraft.file) return setError("Vui lòng chọn tệp ảnh 360° panorama");
        if (fileValidation && fileValidation.ok === false) return setError(fileValidation.msg);
        if (panoDraft.file.size > MAX_PANO_FILE_BYTES)
            return setError(`Tệp ảnh vượt quá ${MAX_PANO_FILE_MB}MB`);

        const cleanLng = panoDraft.lng.trim().replace(",", ".");
        const cleanLat = panoDraft.lat.trim().replace(",", ".");
        const lng = Number(cleanLng);
        const lat = Number(cleanLat);

        if (!cleanLng || !cleanLat || !Number.isFinite(lng) || !Number.isFinite(lat))
            return setError("Vui lòng cung cấp toạ độ hợp lệ (chấm trên bản đồ hoặc nhập tay)");
        if (lng < -180 || lng > 180) return setError("Kinh độ phải trong khoảng -180 đến 180");
        if (lat < -90 || lat > 90) return setError("Vĩ độ phải trong khoảng -90 đến 90");

        let heading: number | null = null;
        if (panoDraft.heading.trim()) {
            const raw = Number(panoDraft.heading.trim().replace(",", "."));
            if (!Number.isFinite(raw) || raw < 0 || raw > 360)
                return setError("Hướng nhìn phải trong khoảng 0–360° (360° ≡ 0°)");
            heading = raw % 360;
        }

        setBusy(true);
        setError(null);
        abortRef.current = new AbortController();

        try {
            await uploadStreetViewImage({ lng, lat, heading, file: panoDraft.file }, apiKey.trim());
            stopLocationRecording();
            setPanoDraft(makeEmptyPanoDraft());
            setFileValidation(null);
            setMode("list");
            await loadPage(0);
            onChanged();
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            setError(errMsg(err));
        } finally {
            setBusy(false);
            abortRef.current = null;
        }
    };

    // ───────── derived labels ─────────
    const hasEditLocation = Boolean(draft.lng.trim() && draft.lat.trim());
    const editLocationLabel = hasEditLocation
        ? `${Number(draft.lat).toFixed(5)}, ${Number(draft.lng).toFixed(5)}`
        : "Ghi nhận vị trí trên bản đồ";

    const hasPanoLocation = Boolean(panoDraft.lng.trim() && panoDraft.lat.trim());
    const panoLocationLabel = hasPanoLocation
        ? `Đã chọn: ${Number(panoDraft.lat).toFixed(5)}, ${Number(panoDraft.lng).toFixed(5)}`
        : "Bấm để kích hoạt chấm vị trí trên bản đồ";

    // ───────── render ─────────
    return (
        <aside className="coord-sidebar sv-management sv-dashboard" aria-label="Quản lý Street View">
            <header className="sv-dashboard__header">
                {mode === "list" ? (
                    <>
                        <div className="sv-dashboard__title">
                            <strong>Quản lý Street View</strong>
                            <span>Ảnh 360° trên bản đồ</span>
                        </div>
                        <div className="sv-dashboard__header-actions">
                            <button
                                type="button"
                                className="sv-btn sv-btn--primary"
                                style={{ padding: "4px 10px", fontSize: "12px", height: "32px" }}
                                onClick={startCreate}
                            >
                                + Thêm 360°
                            </button>
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
                            <strong>{mode === "create" ? "Thêm ảnh 360° mới" : `Ảnh #${selected?.id ?? ""}`}</strong>
                            <span>{mode === "create" ? "Đóng góp panorama" : "Chi tiết panorama"}</span>
                        </div>
                        <button type="button" className="sv-icon-btn" onClick={onClose} aria-label="Đóng">
                            <CloseIcon />
                        </button>
                    </>
                )}
            </header>

            {mode === "detail" && selected ? (
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
                    {mode === "create" ? (
                        <form className="sv-form" onSubmit={handleCreatePano}>
                            <h3 className="sv-form__title">Ảnh 360° Street View mới</h3>

                            <label className="sv-field">
                                <span>API key (bắt buộc để tải lên)</span>
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

                            <button
                                type="button"
                                className={`sv-location-btn${isRecordingLocation ? " is-recording" : ""}${hasPanoLocation ? " has-value" : ""}`}
                                onClick={toggleLocationRecording}
                            >
                                <MapPinIcon size={16} />
                                <span>
                                    {isRecordingLocation
                                        ? "Đang chờ click bản đồ để lấy toạ độ… (bấm để hủy)"
                                        : panoLocationLabel}
                                </span>
                            </button>

                            <div className="sv-form__row">
                                <label className="sv-field">
                                    <span>Kinh độ (Lng) *</span>
                                    <input
                                        inputMode="decimal"
                                        value={panoDraft.lng}
                                        onChange={(e) => setPanoDraft((c) => ({ ...c, lng: e.target.value }))}
                                        placeholder="VD: 105.12345"
                                    />
                                </label>
                                <label className="sv-field">
                                    <span>Vĩ độ (Lat) *</span>
                                    <input
                                        inputMode="decimal"
                                        value={panoDraft.lat}
                                        onChange={(e) => setPanoDraft((c) => ({ ...c, lat: e.target.value }))}
                                        placeholder="VD: 10.12345"
                                    />
                                </label>
                            </div>

                            <label className="sv-field">
                                <span>Hướng nhìn ban đầu (Heading: 0–360°)</span>
                                <input
                                    inputMode="decimal"
                                    value={panoDraft.heading}
                                    onChange={(e) => setPanoDraft((c) => ({ ...c, heading: e.target.value }))}
                                    placeholder="VD: 90"
                                />
                            </label>

                            <label className="sv-field">
                                <span>Tệp ảnh 360° (equirectangular, tỷ lệ 2:1) *</span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
                                />
                                <small style={{ color: "var(--sv-muted)", fontSize: "11px" }}>
                                    Hỗ trợ JPG / PNG / WebP, tối đa {MAX_PANO_FILE_MB}MB.
                                </small>
                            </label>

                            {panoPreviewUrl && (
                                <div className="sv-detail-preview" style={{ marginTop: "8px" }}>
                                    <img
                                        src={panoPreviewUrl}
                                        alt="Xem trước panorama"
                                        style={{ width: "100%", borderRadius: "6px", display: "block" }}
                                    />
                                </div>
                            )}

                            {panoDraft.file && (
                                <div
                                    className="sv-file-info"
                                    style={{
                                        marginTop: "6px",
                                        fontSize: "12px",
                                        color:
                                            fileValidation && fileValidation.ok === false
                                                ? "var(--sv-danger, #d33)"
                                                : "var(--sv-muted)",
                                    }}
                                >
                                    {panoDraft.file.name} · {formatBytes(panoDraft.file.size)}
                                    {fileValidation?.ok === true && " · ✓ tỷ lệ 2:1 hợp lệ"}
                                    {fileValidation?.ok === false && ` · ✗ ${fileValidation.msg}`}
                                </div>
                            )}

                            {error && (
                                <div className="sv-alert" role="alert" aria-live="polite">
                                    <AlertIcon />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="sv-form__actions">
                                <button
                                    type="submit"
                                    className="sv-btn sv-btn--primary"
                                    disabled={busy || fileValidation?.ok === false}
                                >
                                    {busy ? "Đang tải lên và xử lý ảnh…" : "Xác nhận thêm ảnh 360°"}
                                </button>
                                <button
                                    type="button"
                                    className="sv-btn"
                                    onClick={() => {
                                        if (busy) abortRef.current?.abort();
                                        closeCreate();
                                    }}
                                >
                                    Hủy bỏ
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="sv-stats" title="Số liệu thống kê trên các ảnh đã tải">
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
                                <span>API key (để sửa / xoá)</span>
                                <input
                                    type="password"
                                    className={apiKeyError ? "sv-input-error" : ""}
                                    value={apiKey}
                                    onChange={(e) => {
                                        setApiKey(e.target.value);
                                        if (apiKeyError) setApiKeyError(false);
                                    }}
                                    placeholder="Nhập X-API-Key bảo mật"
                                    autoComplete="off"
                                />
                            </label>

                            {editing && (
                                <form ref={formRef} className="sv-form" onSubmit={handleSubmit}>
                                    <h3 className="sv-form__title">Chỉnh sửa ảnh #{editing.id}</h3>

                                    <button
                                        type="button"
                                        className={`sv-location-btn${isRecordingLocation ? " is-recording" : ""}${hasEditLocation ? " has-value" : ""}`}
                                        onClick={toggleLocationRecording}
                                    >
                                        <MapPinIcon size={16} />
                                        <span>
                                            {isRecordingLocation
                                                ? "Bấm lên bản đồ để chọn vị trí… (bấm để hủy)"
                                                : editLocationLabel}
                                        </span>
                                    </button>

                                    <div className="sv-form__row">
                                        <label className="sv-field">
                                            <span>Kinh độ (Lng)</span>
                                            <input
                                                inputMode="decimal"
                                                value={draft.lng}
                                                onChange={(e) => updateDraft("lng", e.target.value)}
                                            />
                                        </label>
                                        <label className="sv-field">
                                            <span>Vĩ độ (Lat)</span>
                                            <input
                                                inputMode="decimal"
                                                value={draft.lat}
                                                onChange={(e) => updateDraft("lat", e.target.value)}
                                            />
                                        </label>
                                    </div>

                                    <label className="sv-field">
                                        <span>Hướng nhìn (0–360°, để trống nếu không rõ)</span>
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
                                        <button type="button" className="sv-btn" onClick={closeEditForm}>
                                            Hủy
                                        </button>
                                    </div>
                                </form>
                            )}

                            {error && (
                                <div className="sv-alert" role="alert" aria-live="polite">
                                    <AlertIcon />
                                    <span>{error}</span>
                                </div>
                            )}

                            <section className="sv-list">
                                <div className="sv-list__head">
                                    <h3>
                                        Danh sách{" "}
                                        <span className="sv-count">
                                            {visibleImages.length}/{total}
                                        </span>
                                    </h3>
                                    <div className="sv-chips" role="group" aria-label="Lọc theo liên kết">
                                        <FilterChip
                                            active={filter === "all"}
                                            onClick={() => setFilter("all")}
                                            label="Tất cả"
                                            count={images.length}
                                        />
                                        <FilterChip
                                            active={filter === "linked"}
                                            onClick={() => setFilter("linked")}
                                            label="Có liên kết"
                                            count={stats.linked}
                                        />
                                        <FilterChip
                                            active={filter === "isolated"}
                                            onClick={() => setFilter("isolated")}
                                            label="Chưa liên kết"
                                            count={stats.isolated}
                                        />
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
                                        <p>
                                            {debouncedSearch || filter !== "all"
                                                ? "Không có ảnh phù hợp với bộ lọc."
                                                : "Chưa có ảnh Street View nào trong hệ thống."}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <ul className="sv-cards">
                                            {visibleImages.map((img) => (
                                                <li key={img.id} className="sv-card">
                                                    <button
                                                        type="button"
                                                        className="sv-card__main"
                                                        onClick={() => openDetail(img)}
                                                    >
                                                        <Thumb src={img.image_url} />
                                                        <div className="sv-card__body">
                                                            <div className="sv-card__top">
                                                                <strong>#{img.id}</strong>
                                                                <span
                                                                    className={`sv-badge ${img.next_ids.length ? "sv-badge--ok" : "sv-badge--warn"}`}
                                                                >
                                                                    {img.next_ids.length
                                                                        ? `${img.next_ids.length} liên kết`
                                                                        : "Chưa liên kết"}
                                                                </span>
                                                            </div>
                                                            <span className="sv-card__meta">
                                                                {headingLabel(img.heading)}
                                                            </span>
                                                            <span className="sv-card__meta sv-card__meta--mono">
                                                                {img.lat.toFixed(5)}, {img.lng.toFixed(5)}
                                                            </span>
                                                        </div>
                                                    </button>

                                                    {confirmDeleteId === img.id ? (
                                                        <div className="sv-confirm">
                                                            <span>Xóa ảnh #{img.id}?</span>
                                                            <button
                                                                type="button"
                                                                className="sv-btn sv-btn--danger"
                                                                disabled={busy}
                                                                onClick={() => handleDelete(img)}
                                                            >
                                                                {busy ? "Đang xóa…" : "Xóa"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="sv-btn"
                                                                onClick={() => setConfirmDeleteId(null)}
                                                            >
                                                                Hủy
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="sv-card__actions">
                                                            <button
                                                                type="button"
                                                                className="sv-btn sv-btn--ghost"
                                                                onClick={() => onGoToImage(img)}
                                                            >
                                                                <MapPinIcon size={14} /> Đến
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="sv-btn sv-btn--ghost"
                                                                onClick={() => beginEdit(img)}
                                                            >
                                                                <EditIcon /> Sửa
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="sv-btn sv-btn--ghost sv-btn--danger-text"
                                                                onClick={() => setConfirmDeleteId(img.id)}
                                                            >
                                                                <TrashIcon /> Xóa
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
                                                {loadingMore
                                                    ? "Đang tải thêm…"
                                                    : `Tải thêm (còn ${total - images.length} ảnh)`}
                                            </button>
                                        )}
                                    </>
                                )}
                            </section>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
}

// ───────────────────────── sub-components ─────────────────────────

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
            className={`sv-chip${active ? " is-active" : ""}`}
            onClick={onClick}
            aria-pressed={active}
        >
            {label} <span>{count}</span>
        </button>
    );
}

function Thumb({ src }: { src: string }) {
    const [failed, setFailed] = useState(false);
    const [retryKey, setRetryKey] = useState<string | null>(null);

    useEffect(() => {
        setFailed(false);
        setRetryKey(null);
    }, [src]);

    const finalSrc = retryKey
        ? `${src}${src.includes("?") ? "&" : "?"}r=${retryKey}`
        : src;

    const handleError = () => {
        if (!retryKey) {
            // Lần đầu lỗi → thử lại với cache-buster (phá cache 404)
            setRetryKey(String(Date.now()));
        } else {
            console.warn("[SV thumb] 404 after retry:", src);
            setFailed(true);
        }
    };

    return (
        <div className="sv-thumb">
            {failed ? (
                <PanoIcon size={22} />
            ) : (
                <img
                    src={finalSrc}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={handleError}
                />
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
                    <span className="sv-panel-card__label">Thông tin chi tiết</span>
                    <span className={`sv-badge ${image.next_ids.length ? "sv-badge--ok" : "sv-badge--warn"}`}>
                        {image.next_ids.length ? "Đã liên kết" : "Chưa liên kết"}
                    </span>
                </div>
                <dl className="sv-dl">
                    <dt>ID Panorama</dt>
                    <dd>#{image.id}</dd>
                    <dt>Hướng nhìn</dt>
                    <dd>{headingLabel(image.heading)}</dd>
                    <dt>Thời gian chụp</dt>
                    <dd>{formatDate(image.captured_at)}</dd>
                    <dt>Đường dẫn tệp</dt>
                    <dd className="sv-dl__break">{image.image_url}</dd>
                </dl>
            </div>

            <div className="sv-panel-card">
                <div className="sv-panel-card__head">
                    <span className="sv-panel-card__label">Tọa độ không gian</span>
                    <button type="button" className="sv-btn sv-btn--ghost" onClick={handleCopy}>
                        {copyState === "ok"
                            ? "Đã chép"
                            : copyState === "fail"
                                ? "Lỗi chép"
                                : "Sao chép tọa độ"}
                    </button>
                </div>
                <div className="sv-coords">
                    <div>
                        <small>LAT</small>
                        <code>{image.lat.toFixed(6)}</code>
                    </div>
                    <div>
                        <small>LNG</small>
                        <code>{image.lng.toFixed(6)}</code>
                    </div>
                </div>
                <button
                    type="button"
                    className="sv-btn sv-btn--primary sv-btn--block"
                    onClick={() => onGoToImage(image)}
                >
                    <MapPinIcon size={16} /> Bay đến vị trí trên bản đồ
                </button>
            </div>

            <div className="sv-panel-card">
                <div className="sv-panel-card__head">
                    <span className="sv-panel-card__label">Các liên kết lân cận</span>
                </div>
                {image.next_ids.length === 0 ? (
                    <p className="sv-muted">Ảnh này hiện đứng độc lập (chưa liên kết).</p>
                ) : (
                    <ul className="sv-links">
                        {image.next_ids.map((id, i) => {
                            const pos = image.link_positions?.[i];
                            return (
                                <li key={`${id}-${i}`}>
                                    <strong>→ #{id}</strong>
                                    <span>
                                        {pos ? `texture (${pos.textureX}, ${pos.textureY})` : "chưa định vị texture"}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {error && (
                <div className="sv-alert" role="alert" aria-live="polite">
                    <AlertIcon />
                    <span>{error}</span>
                </div>
            )}

            {confirmDelete ? (
                <div className="sv-confirm sv-confirm--bar">
                    <span>Xóa ảnh này? Mọi liên kết trỏ tới nó sẽ tự động gỡ sạch.</span>
                    <button
                        type="button"
                        className="sv-btn sv-btn--danger"
                        disabled={busy}
                        onClick={onConfirmDelete}
                    >
                        {busy ? "Đang xóa…" : "Xác nhận xóa"}
                    </button>
                    <button type="button" className="sv-btn" disabled={busy} onClick={onCancelDelete}>
                        Hủy
                    </button>
                </div>
            ) : (
                <div className="sv-detail-actions">
                    <button type="button" className="sv-btn" onClick={onEdit}>
                        <EditIcon /> Sửa thông tin
                    </button>
                    <button
                        type="button"
                        className="sv-btn sv-btn--danger-outline"
                        onClick={onRequestDelete}
                    >
                        <TrashIcon /> Xóa ảnh
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

const CloseIcon = () => (
    <svg {...svg()}>
        <path d="M18 6 6 18M6 6l12 12" />
    </svg>
);
const BackIcon = () => (
    <svg {...svg()}>
        <path d="m15 18-6-6 6-6" />
    </svg>
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
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
const PanoIcon = ({ size = 18 }: { size?: number }) => (
    <svg {...svg(size)}>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
    </svg>
);
const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg {...svg()} className={spinning ? "sv-spin" : undefined}>
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);