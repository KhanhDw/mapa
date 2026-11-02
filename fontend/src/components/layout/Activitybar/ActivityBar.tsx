import "./ActivityBar.css";

export type PanelType =
    | "info"
    | "search"
    | "layers"
    | "electric"
    | "poleManagement"
    | "settings"
    | "contribute";
export type MapType = "esri" | "selfhost" | "osm" | "test";

interface Props {
    activePanel: PanelType | null;
    onPanelToggle: (panel: PanelType) => void;
    mapType: MapType;
    onMapTypeChange: (m: MapType) => void;
    showMapSwitcher: boolean;
}

function ActivityButton({
    active,
    onClick,
    label,
    children,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            className={`activity-bar__btn${active ? " is-active" : ""}`}
            onClick={onClick}
            title={label}
            aria-label={label}
            aria-pressed={active}
        >
            {children}
        </button>
    );
}

export function ActivityBar({
    activePanel,
    onPanelToggle,
    mapType,
    onMapTypeChange,
    showMapSwitcher,
}: Props) {
    return (
        <nav className="activity-bar" aria-label="Thanh công cụ">
            <div className="activity-bar__top">
                <div className="activity-bar__brand" role="img" aria-label="Mapa">
                    <svg viewBox="0 0 32 32" width="23" height="23" aria-hidden="true">
                        <path d="M16 3 28 9.5v13L16 29 4 22.5v-13L16 3Z" fill="currentColor" opacity=".16" />
                        <path d="m16 7 8.5 4.5v9L16 25l-8.5-4.5v-9L16 7Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <circle cx="16" cy="16" r="3" fill="currentColor" />
                    </svg>
                </div>
                <div className="activity-bar__group" role="group" aria-label="Công cụ bản đồ">
                <ActivityButton
                    active={activePanel === "info"}
                    onClick={() => onPanelToggle("info")}
                    label="Thông tin điểm"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5M12 8h.01" />
                    </svg>
                </ActivityButton>

                {/* ▼ MỚI: Tìm kiếm */}
                <ActivityButton
                    active={activePanel === "search"}
                    onClick={() => onPanelToggle("search")}
                    label="Tìm kiếm"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                </ActivityButton>

                <ActivityButton
                    active={activePanel === "layers"}
                    onClick={() => onPanelToggle("layers")}
                    label="Lớp bản đồ"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3l9 5-9 5-9-5 9-5z" />
                        <path d="M3 13l9 5 9-5M3 18l9 5 9-5" />
                    </svg>
                </ActivityButton>

                {/* ▼ MỚI: Điện lực & trụ điện */}
                <ActivityButton
                    active={activePanel === "electric"}
                    onClick={() => onPanelToggle("electric")}
                    label="Thông tin trụ điện"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
                    </svg>
                </ActivityButton>

                <ActivityButton
                    active={activePanel === "poleManagement"}
                    onClick={() => onPanelToggle("poleManagement")}
                    label="Quản lý trụ điện"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v18M6 7h12M8 7l-3 5h6L8 7zm8 0-3 5h6l-3-5zM9 21h6" />
                        <circle cx="12" cy="15" r="2" />
                    </svg>
                </ActivityButton>

                <ActivityButton
                    active={activePanel === "settings"}
                    onClick={() => onPanelToggle("settings")}
                    label="Cài đặt"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                    </svg>
                </ActivityButton>

                <ActivityButton
                    active={activePanel === "contribute"}
                    onClick={() => onPanelToggle("contribute")}
                    label="Đóng góp địa điểm"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v8M8 12h8" />
                    </svg>
                </ActivityButton>
                </div>
            </div>

            {showMapSwitcher && (
                <div className="activity-bar__bottom">
                    <div className="activity-bar__divider" />
                    <div className="activity-bar__group">
                        <ActivityButton
                            active={mapType === "esri"}
                            onClick={() => onMapTypeChange("esri")}
                            label="Esri Satellite"
                        >
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                            </svg>
                        </ActivityButton>
                        <ActivityButton
                            active={mapType === "selfhost"}
                            onClick={() => onMapTypeChange("selfhost")}
                            label="Vệ tinh nội bộ"
                        >
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="7" rx="2" />
                                <rect x="3" y="13" width="18" height="7" rx="2" />
                                <path d="M7 7.5h.01M7 16.5h.01" />
                            </svg>
                        </ActivityButton>
                        <ActivityButton
                            active={mapType === "osm"}
                            onClick={() => onMapTypeChange("osm")}
                            label="OSM Polygon"
                        >
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                                <path d="M9 3v15M15 6v15" />
                            </svg>
                        </ActivityButton>
                        <ActivityButton
                            active={mapType === "test"}
                            onClick={() => onMapTypeChange("test")}
                            label="Test PSV"
                        >
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V3" />
                            </svg>
                        </ActivityButton>
                    </div>
                </div>
            )}
        </nav>
    );
}