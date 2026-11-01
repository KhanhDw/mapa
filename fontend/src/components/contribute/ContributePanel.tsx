import { useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "../sidebar/CoordSidebar/CoordSidebar.css";
import "./ContributePanel.css";
import {
    useContributeForm,
    CONTRIBUTE_CATEGORIES,
} from "./hooks/useContributeForm";
import { useLocationPicker } from "./hooks/useLocationPicker";

interface Props {
    onClose: () => void;
    mapInstance: MapLibreMap | null;
    onCreated?: (poi: { id: number; lng: number; lat: number }) => void;
}

export function ContributePanel({ onClose, mapInstance, onCreated }: Props) {
    const {
        draft, update, setLocation, reset, submit,
        submitting, error, created,
    } = useContributeForm();

    // Bật chế độ click map chọn vị trí khi chưa submit
    useLocationPicker(mapInstance, !created, setLocation);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        const MAX = 20;
        update("photos", [...draft.photos, ...files].slice(0, MAX));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removePhoto = (i: number) => {
        update("photos", draft.photos.filter((_, idx) => idx !== i));
    };

    const handleSubmit = async () => {
        const res = await submit();
        if (res) onCreated?.(res);
    };

    const handleReset = () => {
        reset();
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <aside className="coord-sidebar contribute-panel" aria-label="Đóng góp địa điểm">
            <header className="coord-sidebar__header">
                <div>
                    <h2>Đóng góp địa điểm</h2>
                    <p className="cs-muted">Thêm địa điểm mới cho bản đồ</p>
                </div>
                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                </button>
            </header>

            <div className="coord-sidebar__scroll">
                {created ? (
                    <div className="contribute-success">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#10b981" strokeWidth="2" fill="none">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="8 12 11 15 16 9" />
                        </svg>
                        <h3>Đã gửi thành công!</h3>
                        <p className="cs-muted">
                            Địa điểm <strong>{created.name}</strong> (ID #{created.id}) đã được thêm vào bản đồ.
                        </p>
                        <button type="button" className="cs-btn cs-btn--primary" onClick={handleReset}>
                            Thêm địa điểm khác
                        </button>
                    </div>
                ) : (
                    <>
                        <section className="contribute-section">
                            <div className="contribute-section__title">
                                <span className="contribute-badge">1</span>
                                Vị trí <span className="contribute-required">*</span>
                            </div>
                            {draft.lng != null && draft.lat != null ? (
                                <div className="contribute-location">
                                    📍 {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
                                    <span className="cs-muted">(Click map để đổi)</span>
                                </div>
                            ) : (
                                <div className="contribute-hint">
                                    Click một điểm trên bản đồ để chọn vị trí
                                </div>
                            )}
                        </section>

                        <section className="contribute-section">
                            <div className="contribute-section__title">
                                <span className="contribute-badge">2</span>
                                Thông tin
                            </div>

                            <label className="contribute-field">
                                <span>Tên địa điểm <span className="contribute-required">*</span></span>
                                <input
                                    type="text"
                                    value={draft.name}
                                    maxLength={200}
                                    placeholder="VD: Quán cà phê Mộc"
                                    onChange={(e) => update("name", e.target.value)}
                                />
                            </label>

                            <label className="contribute-field">
                                <span>Danh mục</span>
                                <select
                                    value={draft.category}
                                    onChange={(e) => update("category", e.target.value)}
                                >
                                    {CONTRIBUTE_CATEGORIES.map((c) => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="contribute-field">
                                <span>Địa chỉ</span>
                                <input
                                    type="text"
                                    value={draft.address}
                                    maxLength={300}
                                    placeholder="Số nhà, đường, phường..."
                                    onChange={(e) => update("address", e.target.value)}
                                />
                            </label>

                            <label className="contribute-field">
                                <span>Số điện thoại</span>
                                <input
                                    type="tel"
                                    value={draft.phone}
                                    maxLength={30}
                                    placeholder="0912345678"
                                    onChange={(e) => update("phone", e.target.value)}
                                />
                            </label>

                            <label className="contribute-field">
                                <span>Mô tả</span>
                                <textarea
                                    value={draft.description}
                                    maxLength={2000}
                                    rows={3}
                                    placeholder="Thông tin thêm..."
                                    onChange={(e) => update("description", e.target.value)}
                                />
                            </label>
                        </section>

                        <section className="contribute-section">
                            <div className="contribute-section__title">
                                <span className="contribute-badge">3</span>
                                Ảnh ({draft.photos.length}/20)
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                onChange={handleFiles}
                                style={{ display: "none" }}
                            />
                            <button
                                type="button"
                                className="cs-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={draft.photos.length >= 20}
                            >
                                + Chọn ảnh
                            </button>
                            {draft.photos.length > 0 && (
                                <ul className="contribute-photo-list">
                                    {draft.photos.map((f, i) => (
                                        <li key={i} className="contribute-photo-item">
                                            <span title={f.name}>{f.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(i)}
                                                aria-label="Xoá ảnh"
                                            >✕</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {error && (
                            <div className="cs-alert cs-alert--error">{error}</div>
                        )}

                        <div className="contribute-actions">
                            <button
                                type="button"
                                className="cs-btn"
                                onClick={handleReset}
                                disabled={submitting}
                            >
                                Xoá form
                            </button>
                            <button
                                type="button"
                                className="cs-btn cs-btn--primary"
                                onClick={handleSubmit}
                                disabled={submitting || draft.lng == null}
                            >
                                {submitting ? "Đang gửi..." : "Gửi địa điểm"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}