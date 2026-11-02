import type { PoleData } from "./ElectricPanel";

interface Props {
    onSelect: (pole: PoleData) => void;
    onClose: () => void;
}

// Dữ liệu mẫu (Mock Data) để test UI
const MOCK_POLES: PoleData[] = [
    {
        id: "TD-10294",
        route: "Tuyến 471 - Đường Nguyễn Trãi",
        status: "error",
        statusLabel: "Đang có sự cố",
        updatedAt: "02/11/2026 08:30",
        location: { lat: 20.987, lng: 105.812 },
        images: ["https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=200"],
        incidentCount: 2,
        incidentLevel: "high",
        dataStatus: "verified",
        inputBy: { name: "Nguyễn Văn A", phone: "0912345678", zalo: "0912345678" },
        incidents: [
            {
                id: "SC-001",
                type: "Mất điện cục bộ",
                description: "Nghi ngờ đứt cầu chì tại vị trí trụ.",
                media: [],
                reporter: "Trần B",
                phone: "0988777666",
                date: "01/11/2026"
            }
        ]
    },
    {
        id: "TD-10295",
        route: "Tuyến 471 - Đường Nguyễn Trãi",
        status: "good",
        statusLabel: "Bình thường",
        updatedAt: "01/11/2026 14:20",
        location: { lat: 20.988, lng: 105.813 },
        images: ["https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=200"],
        incidentCount: 0,
        incidentLevel: "low",
        dataStatus: "pending",
        inputBy: { name: "Lê Văn C", phone: "0900111222", zalo: "0900111222" },
        incidents: []
    }
];

export function PoleList({ onSelect, onClose }: Props) {
    return (
        <>
            <header className="coord-sidebar__header">
                <div>
                    <h2>Quản lý Trụ điện</h2>
                    <p className="cs-muted">Tra cứu & Cập nhật dữ liệu</p>
                </div>
                <button type="button" className="coord-sidebar__close" onClick={onClose} aria-label="Đóng">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            <div className="electric-search">
                <div className="electric-search__input-wrap">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                    </svg>
                    <input type="text" placeholder="Nhập Mã trụ hoặc Tuyến đường..." />
                </div>
            </div>

            <div className="coord-sidebar__scroll">
                <div className="electric-list">
                    {MOCK_POLES.map((pole) => (
                        <button
                            key={pole.id}
                            className="electric-card"
                            onClick={() => onSelect(pole)}
                        >
                            <div className="electric-card__header">
                                <span className="electric-card__id">{pole.id}</span>
                                <span className={`electric-badge electric-badge--${pole.status}`}>
                                    {pole.statusLabel}
                                </span>
                            </div>
                            <div className="electric-card__route">{pole.route}</div>
                            <div className="electric-card__footer">
                                <span>Cập nhật: {pole.updatedAt}</span>
                                {pole.incidentCount > 0 && (
                                    <span className="electric-card__incident">
                                        ⚠️ {pole.incidentCount} sự cố
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}