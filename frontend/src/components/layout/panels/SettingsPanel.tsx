import type { ReactNode } from "react";
import type { MapType } from "../Activitybar";
import "../../sidebar/CoordSidebar/CoordSidebar.css";
import "./SettingsPanel.css";

interface Props {
    onClose: () => void;
    mapType: MapType;
    onMapTypeChange: (m: MapType) => void;
    showMapSwitcher: boolean;
}

interface MapOption {
    value: MapType;
    label: string;
    desc: string;
    icon: ReactNode;
}

const MAP_OPTIONS: MapOption[] = [
    {
        value: "esri",
        label: "Esri Satellite",
        desc: "Ảnh vệ tinh độ phân giải cao",
        icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
        ),
    },
    {
        value: "selfhost",
        label: "Vệ tinh nội bộ",
        desc: "Tile server tự vận hành",
        icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="7" rx="2" />
                <rect x="3" y="13" width="18" height="7" rx="2" />
                <path d="M7 7.5h.01M7 16.5h.01" />
            </svg>
        ),
    },
    {
        value: "osm",
        label: "OSM Polygon",
        desc: "Bản đồ vector OpenStreetMap",
        icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                <path d="M9 3v15M15 6v15" />
            </svg>
        ),
    },
    {
        value: "test",
        label: "Test PSV",
        desc: "Trình xem ảnh toàn cảnh",
        icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V3" />
            </svg>
        ),
    },
];

export function SettingsPanel({
    onClose,
    mapType,
    onMapTypeChange,
    showMapSwitcher,
}: Props) {
    return (
        <aside className="coord-sidebar" aria-label="Cài đặt">
            <header className="coord-sidebar__header">
                <div>
                    <h2>Cài đặt</h2>
                    <p className="cs-muted">Tuỳ chỉnh bản đồ và giao diện</p>
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
                {showMapSwitcher && (
                    <section className="cs-section">
                        <header className="cs-section__header">
                            <div className="cs-section__title">
                                <svg className="cs-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                                    <path d="M9 3v15M15 6v15" />
                                </svg>
                                <span>Loại bản đồ</span>
                            </div>
                        </header>
                        <div className="cs-section__body">
                            <div className="settings-map-list">
                                {MAP_OPTIONS.map((opt) => {
                                    const isActive = mapType === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`settings-map-item${isActive ? " is-active" : ""}`}
                                            onClick={() => onMapTypeChange(opt.value)}
                                            aria-pressed={isActive}
                                        >
                                            <span className="settings-map-item__icon">{opt.icon}</span>
                                            <span className="settings-map-item__info">
                                                <span className="settings-map-item__label">{opt.label}</span>
                                                <span className="settings-map-item__desc">{opt.desc}</span>
                                            </span>
                                            {isActive && (
                                                <svg className="settings-map-item__check" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                <section className="cs-section">
                    <header className="cs-section__header">
                        <div className="cs-section__title">
                            <svg className="cs-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 8v4M12 16h.01" />
                            </svg>
                            <span>Khác</span>
                        </div>
                    </header>
                    <div className="cs-section__body">
                        <p className="cs-muted">Các tính năng khác đang phát triển.</p>
                    </div>
                </section>
            </div>
        </aside>
    );
}