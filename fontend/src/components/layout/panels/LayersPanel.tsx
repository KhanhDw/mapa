import "../../sidebar/CoordSidebar/CoordSidebar.css";
import "./LayersPanel.css";
import type { LayerKey, LayerVisibility } from "./types";

interface Props {
    layers: LayerVisibility;
    onToggle: (key: LayerKey) => void;
    onClose: () => void;
}

const svgProps = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
};

const ITEMS: { key: LayerKey; title: string; desc: string; icon: React.ReactNode }[] = [
    {
        key: "roads",
        title: "Lớp đường",
        desc: "Hiển thị từ mức zoom 14",
        icon: (
            <svg {...svgProps}>
                <path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" />
            </svg>
        ),
    },
    {
        key: "roadNames",
        title: "Tên đường",
        desc: "Hiển thị từ mức zoom 15",
        icon: (
            <svg {...svgProps}>
                <path d="M5 19L12 5l7 14M7.5 14h9" />
            </svg>
        ),
    },
    {
        key: "streetview",
        title: "Đường có ảnh 360°",
        desc: "Dấu X xanh, hiển thị từ mức zoom 17",
        icon: (
            <svg {...svgProps}>
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
        ),
    },
];

export function LayersPanel({ layers, onToggle, onClose }: Props) {
    return (
        <aside className="coord-sidebar" aria-label="Lớp bản đồ">
            <header className="coord-sidebar__header">
                <div>
                    <h2>Lớp bản đồ</h2>
                    <p className="cs-muted">Bật/tắt lớp hiển thị</p>
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
                <ul className="layer-list">
                    {ITEMS.map(({ key, title, desc, icon }) => (
                        <li key={key}>
                            <button
                                type="button"
                                className="layer-row"
                                role="switch"
                                aria-checked={layers[key]}
                                onClick={() => onToggle(key)}
                            >
                                <span className="layer-row__icon">{icon}</span>
                                <span className="layer-row__text">
                                    <span className="layer-row__title">{title}</span>
                                    <span className="layer-row__desc">{desc}</span>
                                </span>
                                <span className={`layer-switch${layers[key] ? " is-on" : ""}`}>
                                    <span className="layer-switch__knob" />
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
}