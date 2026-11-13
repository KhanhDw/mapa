
import "./ActivityBar.css";
import {
    MapPin,
    Search,
    Layers,
    Zap,
    Cable,
    Globe2,
    MapPinned,
    CirclePlus,
    Settings,
} from "lucide-react";

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

const iconProps = {
    size: 21,
    strokeWidth: 1.8,
    "aria-hidden": true as const,
};

export function ActivityBar({
    activePanel,
    onPanelToggle,
}: Props) {
    return (
        <nav className="activity-bar" aria-label="Thanh công cụ">

            {/* PHẦN TRÊN */}
            <div className="activity-bar__top">

                <div
                    className="activity-bar__brand"
                    role="img"
                    aria-label="Mapa"
                >
                    <img
                        src="/logo.png"
                        alt="Mapa"
                        width={28}
                        height={28}
                    />
                </div>

                {/* Bản đồ & tìm kiếm */}
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
                        <MapPin {...iconProps} />
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "search"}
                        onClick={() => onPanelToggle("search")}
                        label="Tìm kiếm"
                    >
                        <Search {...iconProps} />
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "layers"}
                        onClick={() => onPanelToggle("layers")}
                        label="Lớp bản đồ"
                    >
                        <Layers {...iconProps} />
                    </ActivityButton>
                </div>

                <div className="activity-bar__divider" />

                {/* Điện lực */}
                <div
                    className="activity-bar__group"
                    role="group"
                    aria-label="Điện lực"
                >
                    <ActivityButton
                        active={activePanel === "electric"}
                        onClick={() => onPanelToggle("electric")}
                        label="Thông tin trụ điện"
                    >
                        <Zap {...iconProps} />
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "poleManagement"}
                        onClick={() => onPanelToggle("poleManagement")}
                        label="Quản lý trụ điện"
                    >
                        <Cable {...iconProps} />
                    </ActivityButton>
                </div>

                <div className="activity-bar__divider" />

                {/* Quản lý hệ thống */}
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
                        <Globe2 {...iconProps} />
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "poiManagement"}
                        onClick={() => onPanelToggle("poiManagement")}
                        label="Quản lý địa điểm (POI)"
                    >
                        <MapPinned {...iconProps} />
                    </ActivityButton>
                </div>
            </div>

            {/* PHẦN DƯỚI */}
            <div className="activity-bar__bottom">

                <div className="activity-bar__divider" />

                <div
                    className="activity-bar__group"
                    role="group"
                    aria-label="Khác"
                >
                    <ActivityButton
                        active={activePanel === "contribute"}
                        onClick={() => onPanelToggle("contribute")}
                        label="Đóng góp địa điểm"
                    >
                        <CirclePlus {...iconProps} />
                    </ActivityButton>

                    <ActivityButton
                        active={activePanel === "settings"}
                        onClick={() => onPanelToggle("settings")}
                        label="Cài đặt"
                    >
                        <Settings {...iconProps} />
                    </ActivityButton>
                </div>
            </div>
        </nav>
    );
}
