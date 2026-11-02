import { useState } from "react";
import type { PoleData } from "./ElectricPanel";

interface Props {
    pole: PoleData;
    onBack: () => void;
    onClose: () => void;
}

export function PoleDetail({ pole, onBack, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<"info" | "incidents" | "history">("info");

    return (
        <>
            <header className="coord-sidebar__header electric-detail-header">
                <div className="electric-detail-header__top">
                    <button type="button" className="coord-sidebar__close" onClick={onBack} aria-label="Quay lại">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <h2>Chi tiết Trụ: {pole.id}</h2>
                    <button type="button" className="coord-sidebar__close" onClick={onClose} aria-label="Đóng">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <div className="electric-detail-header__meta">
                    <span className={`electric-badge electric-badge--${pole.status}`}>{pole.statusLabel}</span>
                    <span className="electric-detail-header__route">{pole.route}</span>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="electric-tabs">
                <button className={activeTab === "info" ? "active" : ""} onClick={() => setActiveTab("info")}>Thông tin</button>
                <button className={activeTab === "incidents" ? "active" : ""} onClick={() => setActiveTab("incidents")}>
                    Sự cố {pole.incidentCount > 0 && <span className="tab-badge">{pole.incidentCount}</span>}
                </button>
                <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>Lịch sử</button>
            </div>

            <div className="coord-sidebar__scroll">
                {/* TAB 1: THÔNG TIN CHUNG */}
                {activeTab === "info" && (
                    <div className="electric-tab-content">
                        {/* Ảnh thực tế */}
                        {pole.images.length > 0 && (
                            <div className="electric-image-preview">
                                <img src={pole.images[0]} alt={`Trụ ${pole.id}`} />
                                <span className="electric-image-preview__count">+{pole.images.length} ảnh</span>
                            </div>
                        )}

                        <div className="electric-info-grid">
                            <div className="electric-info-item">
                                <span className="label">Ngày cập nhật</span>
                                <span className="value">{pole.updatedAt}</span>
                            </div>
                            <div className="electric-info-item">
                                <span className="label">Trạng thái dữ liệu</span>
                                <span className="value">
                                    {pole.dataStatus === "verified" ? "✅ Đã xác minh" : "⏳ Chờ duyệt"}
                                </span>
                            </div>
                        </div>

                        <div className="electric-section">
                            <h3 className="electric-section__title">Thông tin nhập liệu</h3>
                            <div className="electric-info-item">
                                <span className="label">Người nhập</span>
                                <span className="value">{pole.inputBy.name}</span>
                            </div>
                            <div className="electric-info-item">
                                <span className="label">SĐT / Zalo</span>
                                <span className="value">
                                    <a href={`tel:${pole.inputBy.phone}`}>{pole.inputBy.phone}</a>
                                </span>
                            </div>
                        </div>

                        <div className="electric-section">
                            <h3 className="electric-section__title">Vị trí</h3>
                            <div className="electric-info-item">
                                <span className="label">Tọa độ</span>
                                <span className="value">{pole.location.lat}, {pole.location.lng}</span>
                            </div>
                            <a
                                href={`https://maps.google.com/?q=${pole.location.lat},${pole.location.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="electric-btn electric-btn--outline"
                            >
                                Mở Google Maps
                            </a>
                        </div>
                    </div>
                )}

                {/* TAB 2: SỰ CỐ */}
                {activeTab === "incidents" && (
                    <div className="electric-tab-content">
                        {pole.incidents.length === 0 ? (
                            <p className="cs-muted">Không có sự cố nào được ghi nhận.</p>
                        ) : (
                            pole.incidents.map((incident) => (
                                <div key={incident.id} className="electric-incident-card">
                                    <div className="electric-incident-card__header">
                                        <span className="electric-incident-card__type">{incident.type}</span>
                                        <span className="electric-incident-card__date">{incident.date}</span>
                                    </div>
                                    <p className="electric-incident-card__desc">{incident.description}</p>
                                    <div className="electric-incident-card__reporter">
                                        <span>Báo cáo: {incident.reporter} - {incident.phone}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* TAB 3: LỊCH SỬ CẬP NHẬT */}
                {activeTab === "history" && (
                    <div className="electric-tab-content">
                        <div className="electric-timeline">
                            <div className="electric-timeline__item">
                                <div className="electric-timeline__dot"></div>
                                <div className="electric-timeline__content">
                                    <span className="electric-timeline__date">{pole.updatedAt}</span>
                                    <p className="electric-timeline__text">Cập nhật bởi <strong>{pole.inputBy.name}</strong></p>
                                    {pole.updateContent && <p className="electric-timeline__desc">{pole.updateContent}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}