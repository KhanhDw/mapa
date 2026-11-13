
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    Check,
    CheckCircle2,
    Clock3,
    Copy,
    Crosshair,
    FileText,
    MapPin,
    MoreHorizontal,
    RadioTower,
    X,
} from "lucide-react";

import type { ElectricPole } from "../../../../api/electricPoles";
import "./PoleDetailPanel.css";

interface Props {
    pole: ElectricPole | null;
    onClose: () => void;
    onGoToPole: (pole: ElectricPole) => void;
}

type CopyState = "idle" | "ok" | "fail";

const STATUS_CONFIG: Record<
    ElectricPole["status"],
    {
        label: string;
        description: string;
        icon: typeof CheckCircle2;
    }
> = {
    good: {
        label: "Bình thường",
        description: "Thiết bị đang hoạt động bình thường",
        icon: CheckCircle2,
    },
    warning: {
        label: "Cảnh báo",
        description: "Thiết bị cần được kiểm tra",
        icon: AlertTriangle,
    },
    error: {
        label: "Đang có sự cố",
        description: "Thiết bị đang ghi nhận sự cố",
        icon: AlertCircle,
    },
};

function SectionTitle({
    icon: Icon,
    label,
    caption,
}: {
    icon: typeof MapPin;
    label: string;
    caption?: string;
}) {
    return (
        <div className="pd-section-heading">
            <span className="pd-section-title__icon" aria-hidden="true">
                <Icon size={16} strokeWidth={1.8} />
            </span>

            <span className="pd-section-heading__text">
                <span className="pd-section-title">{label}</span>
                {caption && <span className="pd-section-caption">{caption}</span>}
            </span>
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
            <span className={`pd-info-row__value${mono ? " is-mono" : ""}`}>
                {value}
            </span>
        </div>
    );
}

function formatDate(value: string | Date) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Chưa cập nhật";
    }

    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function PoleDetailPanel({
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
        return () => {
            if (timer.current !== undefined) {
                window.clearTimeout(timer.current);
            }
        };
    }, []);

    const infoKey = pole ? `${pole.lng}|${pole.lat}` : "";

    const copy =
        copyState.key === infoKey ? copyState.value : "idle";

    const handleCopy = async () => {
        if (!pole) return;

        const coordinates = `${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}`;

        if (timer.current !== undefined) {
            window.clearTimeout(timer.current);
        }

        try {
            await navigator.clipboard.writeText(coordinates);

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

    const status = pole ? STATUS_CONFIG[pole.status] : null;
    const StatusIcon = status?.icon;

    return (
        <aside
            className="pole-detail-panel"
            aria-label="Thông tin chi tiết trụ điện"
            aria-busy="false"
        >
            <header className="pole-detail-panel__header">
                <div className="pole-detail-panel__heading">
                    <div className="pd-header__eyebrow">
                        <span className="pd-header__brand-icon">
                            <RadioTower size={15} />
                        </span>
                        <span>QUẢN LÝ TÀI SẢN</span>
                    </div>

                    <h2>Chi tiết trụ điện</h2>

                    <p className="pole-detail-panel__muted">
                        {pole
                            ? `Mã tài sản: ${pole.pole_code}`
                            : "Thông tin tài sản trên bản đồ"}
                    </p>
                </div>

                <button
                    type="button"
                    className="pole-detail-panel__close"
                    onClick={onClose}
                    aria-label="Đóng bảng chi tiết"
                    title="Đóng"
                >
                    <X size={18} />
                </button>
            </header>

            {!pole ? (
                <div className="pole-detail-panel__empty">
                    <div className="pole-detail-panel__empty-icon">
                        <RadioTower size={28} strokeWidth={1.6} />
                    </div>

                    <p className="pole-detail-panel__empty-title">
                        Chưa chọn trụ điện
                    </p>

                    <p className="pole-detail-panel__empty-desc">
                        Chọn một trụ điện trên bản đồ hoặc trong danh sách để xem
                        trạng thái, tọa độ và thông tin vận hành.
                    </p>

                    <span className="pole-detail-panel__empty-hint">
                        <span className="pd-hint-dot" />
                        Đang chờ lựa chọn
                    </span>
                </div>
            ) : (
                <div className="pole-detail-panel__scroll">
                    {/* ASSET OVERVIEW */}
                    <section className="pd-identity">
                        <div className="pd-identity__topline">
                            <span className="pd-overline">THIẾT BỊ ĐIỆN</span>

                            {status && (
                                <span className={`pd-status pd-status--${pole.status}`}>
                                    <span className="pd-status__dot" />
                                    {status.label}
                                </span>
                            )}
                        </div>

                        <h3 className="pd-identity__code">{pole.pole_code}</h3>

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

                        {status && StatusIcon && (
                            <div className={`pd-status-summary pd-status-summary--${pole.status}`}>
                                <StatusIcon size={15} />
                                <span>{status.description}</span>
                            </div>
                        )}
                    </section>

                    {/* LOCATION */}
                    <section className="pd-section">
                        <div className="pd-section__header">
                            <SectionTitle
                                icon={MapPin}
                                label="Vị trí & tọa độ"
                                caption="Vị trí địa lý của thiết bị"
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
                                        ? "Không thể sao chép, thử lại"
                                        : "Sao chép tọa độ"
                                }
                            >
                                {copy === "ok" ? (
                                    <>
                                        <Check size={14} />
                                        Đã sao chép
                                    </>
                                ) : copy === "fail" ? (
                                    <>
                                        <AlertCircle size={14} />
                                        Thử lại
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
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
                            <Crosshair size={17} />
                            <span>Định vị trên bản đồ</span>
                            <MoreHorizontal
                                className="pd-btn__arrow"
                                size={17}
                            />
                        </button>
                    </section>

                    {/* DETAIL */}
                    {pole.detail && (
                        <section className="pd-section">
                            <div className="pd-section__header">
                                <SectionTitle
                                    icon={FileText}
                                    label="Thông tin chi tiết"
                                    caption="Mô tả và ghi chú tài sản"
                                />
                            </div>

                            <div className="pd-detail-card">
                                <p className="pd-detail-text">{pole.detail}</p>
                            </div>
                        </section>
                    )}

                    {/* HISTORY */}
                    <section className="pd-section">
                        <div className="pd-section__header">
                            <SectionTitle
                                icon={Clock3}
                                label="Lịch sử dữ liệu"
                                caption="Thời gian ghi nhận trên hệ thống"
                            />
                        </div>

                        <div className="pd-data-card">
                            <InfoRow
                                label="Ngày tạo"
                                value={formatDate(pole.created_at)}
                            />

                            <div className="pd-data-card__divider" />

                            <InfoRow
                                label="Cập nhật lần cuối"
                                value={formatDate(pole.updated_at)}
                            />
                        </div>
                    </section>

                    <footer className="pd-panel-footer">
                        <span className="pd-panel-footer__indicator" />
                        <span>Dữ liệu tài sản</span>
                        <span className="pd-panel-footer__spacer" />
                        <Activity size={13} />
                        <span>Thông tin chi tiết</span>
                    </footer>
                </div>
            )}
        </aside>
    );
}

export default PoleDetailPanel;
