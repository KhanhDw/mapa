import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ElectricPole } from "../../../../api/electricPoles";
import "./PoleDetail.css";

interface Props {
    pole: ElectricPole | null;
    onClose: () => void;
    onGoToPole: (pole: ElectricPole) => void;
}

const STATUS_LABELS: Record<ElectricPole["status"], string> = {
    good: "Bình thường",
    warning: "Cảnh báo",
    error: "Đang có sự cố",
};

type CopyState = "idle" | "ok" | "fail";

function Icon({ children }: { children: ReactNode }) {
    return (
        <svg
            className="pd-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
    return (
        <div className="pd-section-title">
            {icon}
            <span>{label}</span>
        </div>
    );
}

export function PoleDetail({ pole, onClose, onGoToPole }: Props) {
    const [copyState, setCopyState] = useState<{ key: string; value: CopyState }>({
        key: "",
        value: "idle",
    });
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const infoKey = pole ? `${pole.lng}|${pole.lat}` : "";
    const copy: CopyState = copyState.key === infoKey ? copyState.value : "idle";
    const setCopy = (value: CopyState) => setCopyState({ key: infoKey, value });

    const handleCopy = async () => {
        if (!pole) return;
        const text = `${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}`;
        window.clearTimeout(timer.current);
        try {
            await navigator.clipboard.writeText(text);
            setCopy("ok");
        } catch {
            setCopy("fail");
        }
        timer.current = window.setTimeout(() => setCopy("idle"), 2000);
    };

    return (
        <aside className="pole-detail-panel" aria-label="Thông tin trụ điện">
            <header className="pole-detail-panel__header">
                <div>
                    <h2>Thông tin trụ điện</h2>
                    <p className="pole-detail-panel__muted">
                        {pole ? pole.pole_code : "Chọn một trụ điện trên bản đồ"}
                    </p>
                </div>
                <button
                    type="button"
                    className="pole-detail-panel__close"
                    onClick={onClose}
                    aria-label="Đóng thanh thông tin"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            {!pole ? (
                <div className="pole-detail-panel__empty">
                    <div className="pole-detail-panel__empty-icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 3v18M8 7h8M8 11h8M8 15h8M6 21h12" />
                        </svg>
                    </div>
                    <p className="pole-detail-panel__empty-title">Chưa chọn trụ điện</p>
                    <p className="pole-detail-panel__empty-desc">
                        Nhấp vào một trụ điện trên bản đồ hoặc từ danh sách trụ gần đây để xem chi tiết.
                    </p>
                </div>
            ) : (
                <div className="pole-detail-panel__scroll">
                    {/* Card: Trạng thái + Mã + Tuyến */}
                    <div className="pd-card">
                        <div className="pd-card__header">
                            <SectionTitle
                                label="Trạng thái"
                                icon={
                                    <Icon>
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 8v4M12 16h.01" />
                                    </Icon>
                                }
                            />
                            <span className={`pd-status pd-status--${pole.status}`}>
                                {STATUS_LABELS[pole.status]}
                            </span>
                        </div>
                        <div className="pd-coords">
                            <div className="pd-coords__row">
                                <span className="pd-coords__label">MÃ TRỤ</span>
                                <span className="pd-coords__val">{pole.pole_code}</span>
                            </div>
                            <div className="pd-coords__row">
                                <span className="pd-coords__label">TUYẾN</span>
                                <span className="pd-coords__val">{pole.route || "—"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Card: Tọa độ + Copy + Đến vị trí */}
                    <div className="pd-card">
                        <div className="pd-card__header">
                            <SectionTitle
                                label="Tọa độ"
                                icon={
                                    <Icon>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </Icon>
                                }
                            />
                            <button
                                type="button"
                                className={`pd-copy-btn${copy === "ok" ? " is-success" : copy === "fail" ? " is-error" : ""}`}
                                onClick={handleCopy}
                                aria-label={copy === "fail" ? "Thử sao chép lại" : "Sao chép tọa độ"}
                            >
                                {copy === "ok" ? (
                                    <>
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Đã chép
                                    </>
                                ) : copy === "fail" ? (
                                    <>Thử lại</>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        Sao chép
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="pd-coords">
                            <div className="pd-coords__row">
                                <span className="pd-coords__label">LAT</span>
                                <span className="pd-coords__val">{pole.lat.toFixed(6)}</span>
                            </div>
                            <div className="pd-coords__row">
                                <span className="pd-coords__label">LNG</span>
                                <span className="pd-coords__val">{pole.lng.toFixed(6)}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="pd-btn pd-btn--primary"
                            onClick={() => onGoToPole(pole)}
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                            </svg>
                            Đến vị trí
                        </button>
                    </div>

                    {/* Section: Chi tiết */}
                    {pole.detail && (
                        <section className="pd-section">
                            <header className="pd-section__header">
                                <SectionTitle
                                    label="Thông tin chi tiết"
                                    icon={
                                        <Icon>
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                                        </Icon>
                                    }
                                />
                            </header>
                            <p className="pd-detail-text">{pole.detail}</p>
                        </section>
                    )}

                    {/* Section: Lịch sử */}
                    <section className="pd-section">
                        <header className="pd-section__header">
                            <SectionTitle
                                label="Lịch sử"
                                icon={
                                    <Icon>
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 2" strokeLinecap="round" />
                                    </Icon>
                                }
                            />
                        </header>
                        <div className="pd-coords">
                            <div className="pd-coords__row">
                                <span className="pd-coords__label">TẠO LÚC</span>
                                <span className="pd-coords__val">
                                    {new Date(pole.created_at).toLocaleString("vi-VN")}
                                </span>
                            </div>
                            <div className="pd-coords__row">
                                <span className="pd-coords__label">CẬP NHẬT</span>
                                <span className="pd-coords__val">
                                    {new Date(pole.updated_at).toLocaleString("vi-VN")}
                                </span>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </aside>
    );
}