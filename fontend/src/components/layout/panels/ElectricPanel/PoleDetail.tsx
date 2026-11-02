import type { ElectricPole } from "../../../../api/electricPoles";

interface Props {
    pole: ElectricPole | null;
    onClose: () => void;
}

const STATUS_LABELS = {
    good: "Bình thường",
    warning: "Cảnh báo",
    error: "Đang có sự cố",
} as const;

export function PoleDetail({ pole, onClose }: Props) {
    return (
        <>
            <header className="coord-sidebar__header">
                <div>
                    <h2>Thông tin trụ điện</h2>
                    <p className="cs-muted">
                        {pole ? pole.pole_code : "Chọn một trụ điện trên bản đồ"}
                    </p>
                </div>
                <button type="button" className="coord-sidebar__close" onClick={onClose} aria-label="Đóng">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            {pole ? (
                <div className="coord-sidebar__scroll electric-detail">
                    <div className="electric-info-item">
                        <span className="label">Trạng thái</span>
                        <span className={`electric-badge electric-badge--${pole.status}`}>
                            {STATUS_LABELS[pole.status]}
                        </span>
                    </div>
                    <div className="electric-info-item">
                        <span className="label">Tuyến đường</span>
                        <span className="value">{pole.route}</span>
                    </div>
                    <div className="electric-info-item">
                        <span className="label">Tọa độ</span>
                        <span className="value">{pole.lat}, {pole.lng}</span>
                    </div>
                    {pole.detail && (
                        <div className="electric-info-item">
                            <span className="label">Thông tin chi tiết</span>
                            <p className="electric-detail__text">{pole.detail}</p>
                        </div>
                    )}
                    <a
                        href={`https://maps.google.com/?q=${pole.lat},${pole.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="electric-btn electric-btn--outline"
                    >
                        Mở Google Maps
                    </a>
                </div>
            ) : (
                <div className="coord-sidebar__scroll">
                    <p className="cs-muted">Chọn biểu tượng trụ điện trên bản đồ để xem thông tin.</p>
                </div>
            )}
        </>
    );
}