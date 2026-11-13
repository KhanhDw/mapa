
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

function Icon({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <svg
            className={`pd-icon ${className}`.trim()}
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

function SectionTitle({
    icon,
    label,
}: {
    icon: ReactNode;
    label: string;
}) {
    return (
        <div className="pd-section-title">
            <span className="pd-section-title__icon">{icon}</span>
            <span>{label}</span>
        </div>
    );
}

function InfoRow({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="pd-info-row">
            <span className="pd-info-row__label">{label}</span>
            <span
                className={`pd-info-row__value${mono ? " is-mono" : ""}`}
            >
                {value}
            </span>
        </div>
    );
}

export function PoleDetail({
    pole,
    onClose,
    onGoToPole,
}: Props) {
    const [copyState, setCopyState] = useState<{
        key: string;
        value: CopyState;
    }>({
        key: "",
        value: "idle",
    });

    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => window.clearTimeout(timer.current);
    }, []);

    const infoKey = pole ? `${pole.lng}|${pole.lat}` : "";

    const copy: CopyState =
        copyState.key === infoKey ? copyState.value : "idle";

    const handleCopy = async () => {
        if (!pole) return;

        const text = `${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}`;

        window.clearTimeout(timer.current);

        try {
            await navigator.clipboard.writeText(text);

            setCopyState({
                key: infoKey,
                value: "ok",
            });
        } catch {
            setCopyState({
                key: infoKey,
                value: "fail",
            });
        }

        timer.current = window.setTimeout(() => {
            setCopyState({
                key: infoKey,
                value: "idle",
            });
        }, 2200);
    };

    return (
        <aside
            className="pole-detail-panel"
            aria-label="Thông tin trụ điện"
        >
            {/* HEADER */}
            <header className="pole-detail-panel__header">
                <div className="pole-detail-panel__heading">
                    <span className="pole-detail-panel__eyebrow">
                        QUẢN LÝ TÀI SẢN
                    </span>

                    <h2>Chi tiết trụ điện</h2>

                    <p className="pole-detail-panel__muted">
                        {pole
                            ? pole.pole_code
                            : "Thông tin tài sản trên bản đồ"}
                    </p>
                </div>

                <button
                    type="button"
                    className="pole-detail-panel__close"
                    onClick={onClose}
                    aria-label="Đóng thanh thông tin"
                    title="Đóng"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        fill="none"
                    >
                        <path
                            d="M18 6L6 18M6 6l12 12"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </header>

            {/* EMPTY STATE */}
            {!pole ? (
                <div className="pole-detail-panel__empty">
                    <div className="pole-detail-panel__empty-icon">
                        <Icon>
                            <path d="M12 3v18M8 7h8M8 11h8M8 15h8M6 21h12" />
                            <path d="M5 5h14" />
                        </Icon>
                    </div>

                    <p className="pole-detail-panel__empty-title">
                        Chưa chọn trụ điện
                    </p>

                    <p className="pole-detail-panel__empty-desc">
                        Chọn một trụ điện trên bản đồ hoặc trong danh
                        sách để xem trạng thái, tọa độ và thông tin
                        vận hành.
                    </p>

                    <span className="pole-detail-panel__empty-hint">
                        <span className="pd-hint-dot" />
                        Đang chờ lựa chọn
                    </span>
                </div>
            ) : (
                <div className="pole-detail-panel__scroll">

                    {/* ASSET IDENTITY */}
                    <section className="pd-identity">
                        <div className="pd-identity__topline">
                            <span className="pd-overline">
                                THIẾT BỊ ĐIỆN
                            </span>

                            <span
                                className={`pd-status pd-status--${pole.status}`}
                            >
                                <span className="pd-status__dot" />
                                {STATUS_LABELS[pole.status]}
                            </span>
                        </div>

                        <h3 className="pd-identity__code">
                            {pole.pole_code}
                        </h3>

                        <p className="pd-identity__caption">
                            Mã định danh trụ điện
                        </p>

                        <div className="pd-identity__meta">
                            <span className="pd-identity__meta-label">
                                Tuyến quản lý
                            </span>

                            <span className="pd-identity__meta-value">
                                {pole.route || "Chưa cập nhật"}
                            </span>
                        </div>
                    </section>

                    {/* LOCATION */}
                    <section className="pd-section">
                        <div className="pd-section__header">
                            <SectionTitle
                                label="Vị trí & tọa độ"
                                icon={
                                    <Icon>
                                        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                                        <circle cx="12" cy="10" r="2.5" />
                                    </Icon>
                                }
                            />

                            <button
                                type="button"
                                className={`pd-copy-btn${copy === "ok"
                                    ? " is-success"
                                    : copy === "fail"
                                        ? " is-error"
                                        : ""
                                    }`}
                                onClick={handleCopy}
                                aria-live="polite"
                                aria-label={
                                    copy === "fail"
                                        ? "Thử sao chép lại tọa độ"
                                        : "Sao chép tọa độ"
                                }
                            >
                                {copy === "ok" ? (
                                    <>
                                        <Icon>
                                            <path d="m5 12 4 4L19 6" />
                                        </Icon>
                                        Đã sao chép
                                    </>
                                ) : copy === "fail" ? (
                                    <>Không thể chép · Thử lại</>
                                ) : (
                                    <>
                                        <Icon>
                                            <rect
                                                x="8"
                                                y="8"
                                                width="13"
                                                height="13"
                                                rx="2"
                                            />
                                            <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                                        </Icon>
                                        Sao chép
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="pd-data-card">
                            <InfoRow
                                label="Vĩ độ (LAT)"
                                value={pole.lat.toFixed(6)}
                                mono
                            />

                            <div className="pd-data-card__divider" />

                            <InfoRow
                                label="Kinh độ (LNG)"
                                value={pole.lng.toFixed(6)}
                                mono
                            />
                        </div>

                        <button
                            type="button"
                            className="pd-btn pd-btn--primary"
                            onClick={() => onGoToPole(pole)}
                        >
                            <Icon>
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                            </Icon>

                            Định vị trên bản đồ

                            <Icon className="pd-btn__arrow">
                                <path d="M5 12h14m-6-6 6 6-6 6" />
                            </Icon>
                        </button>
                    </section>

                    {/* DETAIL */}
                    {pole.detail && (
                        <section className="pd-section">
                            <div className="pd-section__header">
                                <SectionTitle
                                    label="Thông tin chi tiết"
                                    icon={
                                        <Icon>
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                                        </Icon>
                                    }
                                />
                            </div>

                            <div className="pd-detail-card">
                                <p className="pd-detail-text">
                                    {pole.detail}
                                </p>
                            </div>
                        </section>
                    )}

                    {/* HISTORY */}
                    <section className="pd-section">
                        <div className="pd-section__header">
                            <SectionTitle
                                label="Lịch sử dữ liệu"
                                icon={
                                    <Icon>
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 2" />
                                    </Icon>
                                }
                            />
                        </div>

                        <div className="pd-data-card">
                            <InfoRow
                                label="Ngày tạo"
                                value={new Date(
                                    pole.created_at
                                ).toLocaleString("vi-VN")}
                            />

                            <div className="pd-data-card__divider" />

                            <InfoRow
                                label="Cập nhật lần cuối"
                                value={new Date(
                                    pole.updated_at
                                ).toLocaleString("vi-VN")}
                            />
                        </div>
                    </section>

                    {/* FOOTER */}
                    <footer className="pd-panel-footer">
                        <span className="pd-panel-footer__indicator" />
                        Dữ liệu tài sản
                    </footer>
                </div>
            )}
        </aside>
    );
}
