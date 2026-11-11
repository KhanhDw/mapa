import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { uploadStreetViewImage } from "../../../api/streetview";

interface CreateFormProps {
    apiKey: string;
    setApiKey: (key: string) => void;
    apiKeyError: boolean;
    setApiKeyError: (val: boolean) => void;
    isRecordingLocation: boolean;
    onStartLocationRecording: (cb: (loc: { lng: number; lat: number }) => void) => void;
    onStopLocationRecording: () => void;
    onSuccess: () => void;
    onCancel: () => void;
}

interface NewPanoramaDraft {
    lng: string;
    lat: string;
    heading: string;
    file: File | null;
}

const makeEmptyPanoDraft = (): NewPanoramaDraft => ({ lng: "", lat: "", heading: "", file: null });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra");

export function StreetViewCreateForm({
    apiKey,
    setApiKey,
    apiKeyError,
    setApiKeyError,
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    onSuccess,
    onCancel,
}: CreateFormProps) {
    const [panoDraft, setPanoDraft] = useState<NewPanoramaDraft>(makeEmptyPanoDraft);
    const [panoPreviewUrl, setPanoPreviewUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

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

    useEffect(() => {
        if (!panoDraft.file) {
            setPanoPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(panoDraft.file);
        setPanoPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [panoDraft.file]);

    const stopLocationRecording = () => {
        if (isRecordingLocation) onStopLocationRecording();
    };

    const applyLocation = ({ lng, lat }: { lng: number; lat: number }) => {
        setPanoDraft((c) => ({ ...c, lng: String(lng), lat: String(lat) }));
    };

    const toggleLocationRecording = () => {
        if (isRecordingLocation) {
            onStopLocationRecording();
            return;
        }
        onStartLocationRecording(applyLocation);
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

        const cleanLng = panoDraft.lng.trim().replace(",", ".");
        const cleanLat = panoDraft.lat.trim().replace(",", ".");
        const lng = Number(cleanLng);
        const lat = Number(cleanLat);

        if (!cleanLng || !cleanLat || !Number.isFinite(lng) || !Number.isFinite(lat))
            return setError("Vui lòng cung cấp toạ độ hợp lệ");

        let heading: number | null = null;
        if (panoDraft.heading.trim()) {
            const raw = Number(panoDraft.heading.trim().replace(",", "."));
            if (!Number.isFinite(raw) || raw < 0 || raw > 360)
                return setError("Hướng nhìn phải trong khoảng 0–360°");
            heading = raw % 360;
        }

        setBusy(true);
        setError(null);
        abortRef.current = new AbortController();

        try {
            await uploadStreetViewImage({ lng, lat, heading, file: panoDraft.file }, apiKey.trim());
            stopLocationRecording();
            setPanoDraft(makeEmptyPanoDraft());
            onSuccess();
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            setError(errMsg(err));
        } finally {
            setBusy(false);
            abortRef.current = null;
        }
    };

    const hasPanoLocation = Boolean(panoDraft.lng.trim() && panoDraft.lat.trim());
    const panoLocationLabel = hasPanoLocation
        ? `Đã chọn: ${Number(panoDraft.lat).toFixed(5)}, ${Number(panoDraft.lng).toFixed(5)}`
        : "Bấm để kích hoạt chấm vị trí trên bản đồ";

    return (
        <form className="sv-form" onSubmit={handleCreatePano}>
            <h3 className="sv-form__title">Ảnh 360° Street View mới</h3>

            <label className="sv-field">
                <span>API key (bảo mật)</span>
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
                <span>Tệp ảnh 360° *</span>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPanoDraft((c) => ({ ...c, file: e.target.files?.[0] || null }))}
                />
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
                    disabled={busy}
                >
                    {busy ? "Đang tải lên và xử lý ảnh…" : "Xác nhận thêm ảnh 360°"}
                </button>
                <button
                    type="button"
                    className="sv-btn"
                    onClick={() => {
                        if (busy) abortRef.current?.abort();
                        onCancel();
                    }}
                >
                    Hủy bỏ
                </button>
            </div>
        </form>
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

const MapPinIcon = ({ size = 18 }: { size?: number }) => <svg {...svg(size)}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
const AlertIcon = () => <svg {...svg(16)}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>;