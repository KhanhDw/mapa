import "./ActivityBar.css";

export type PanelType =
    | "info"
    | "search"
    | "layers"
    | "electric"
    | "poleManagement"
    | "streetviewManagement"
    | "poiManagement"
    | "settings"
    | "contribute";
export type MapType = "esri" | "selfhost" | "osm" | "test";

interface Props {
    activePanel: PanelType | null;
    onPanelToggle: (panel: PanelType) => void;
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

export function ActivityBar({ activePanel, onPanelToggle }: Props) {
    return (
        <nav className="activity-bar" aria-label="Thanh công cụ">
            {/* PHẦN TRÊN: Logo & Các nhóm chức năng chính */}
            <div className="activity-bar__top">
                <div className="activity-bar__brand" role="img" aria-label="Mapa">
                    <img src="/logo.png" alt="Mapa" width={28} height={28} />
                </div>

                <div
                    className="activity-bar__group"
                    role="group"
                    aria-label="Bản đồ & tìm kiếm"
                >
                    <ActivityButton
                        active={activePanel === "info"}
                        onClick={() => onPanelToggle("info")}
                        label="Thông tin điểm"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                            <circle cx="12" cy="10" r="2.5" />
                        </svg>
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "search"}
                        onClick={() => onPanelToggle("search")}
                        label="Tìm kiếm"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </svg>
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "layers"}
                        onClick={() => onPanelToggle("layers")}
                        label="Lớp bản đồ"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 3l9 5-9 5-9-5 9-5z" />
                            <path d="M3 13l9 5 9-5M3 18l9 5 9-5" />
                        </svg>
                    </ActivityButton>
                </div>

                <div className="activity-bar__divider" />

                <div className="activity-bar__group" role="group" aria-label="Điện lực">
                    <ActivityButton
                        active={activePanel === "electric"}
                        onClick={() => onPanelToggle("electric")}
                        label="Thông tin trụ điện"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
                        </svg>
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "poleManagement"}
                        onClick={() => onPanelToggle("poleManagement")}
                        label="Quản lý trụ điện"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 3v18M6 7h12M8 7l-3 5h6L8 7zm8 0-3 5h6l-3-5zM9 21h6" />
                            <circle cx="12" cy="15" r="2" />
                        </svg>
                    </ActivityButton>
                </div>

                <div className="activity-bar__divider" />

                <div
                    className="activity-bar__group"
                    role="group"
                    aria-label="Quản lý hệ thống"
                >
                    <ActivityButton
                        active={activePanel === "streetviewManagement"}
                        onClick={() => onPanelToggle("streetviewManagement")}
                        label="Quản lý ảnh Street View"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18" />
                        </svg>
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "poiManagement"}
                        onClick={() => onPanelToggle("poiManagement")}
                        label="Quản lý địa điểm (POI)"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                            <circle cx="12" cy="10" r="2.5" />
                            <path d="M16 21h5M18.5 18.5v5" />
                        </svg>
                    </ActivityButton>
                </div>
            </div>

            {/* PHẦN DƯỚI: Ghim xuống đáy Activity Bar */}
            <div className="activity-bar__bottom">
                <div className="activity-bar__divider" />

                <div className="activity-bar__group" role="group" aria-label="Khác">
                    <ActivityButton
                        active={activePanel === "contribute"}
                        onClick={() => onPanelToggle("contribute")}
                        label="Đóng góp địa điểm"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v8M8 12h8" />
                        </svg>
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "settings"}
                        onClick={() => onPanelToggle("settings")}
                        label="Cài đặt"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="21"
                            height="21"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                        </svg>
                    </ActivityButton>
                </div>
            </div>
        </nav>
    );
}