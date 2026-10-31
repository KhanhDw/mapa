import "../../sidebar/CoordSidebar/CoordSidebar.css";
import "./LayersPanel.css";
import type { LayerKey, LayerVisibility } from "./types";
import { LAYER_GROUPS, LAYER_META } from "../../maps/EsriSatelliteMap/layers/registry";

interface Props {
    layers: LayerVisibility;
    onToggle: (key: LayerKey) => void;
    onClose: () => void;
}

const svg = {
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

const ICONS: Partial<Record<LayerKey, React.ReactNode>> = {
    streetview: <svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg>,
    roads: <svg {...svg}><path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" /></svg>,
    roadNames: <svg {...svg}><path d="M5 19L12 5l7 14M7.5 14h9" /></svg>,
    roadsMajor: <svg {...svg}><path d="M4 20L12 4l8 16M8 14h8" /></svg>,
    roadsMinor: <svg {...svg}><path d="M6 20L12 8l6 12" /></svg>,
    roadsLocal: <svg {...svg}><path d="M8 20L12 10l4 10" /></svg>,
    railways: <svg {...svg}><path d="M6 4v16M18 4v16M6 8h12M6 12h12M6 16h12" /></svg>,
    water: <svg {...svg}><path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>,
    waterways: <svg {...svg}><path d="M3 8c3 0 3 4 6 4s3-4 6-4 3 4 6 4M3 16c3 0 3 4 6 4s3-4 6-4 3 4 6 4" /></svg>,
    landuse: <svg {...svg}><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>,
    natural: <svg {...svg}><path d="M12 3l4 6-4 2-4-2 4-6zM8 13l4-2 4 2-4 8-4-8z" /></svg>,
    protected: <svg {...svg}><path d="M12 3l8 4v6c0 5-4 8-8 8s-8-3-8-8V7l8-4z" /></svg>,
    buildings: <svg {...svg}><rect x="4" y="6" width="16" height="14" rx="1" /><path d="M9 6V3h6v3M9 11h.01M15 11h.01M9 15h.01M15 15h.01" /></svg>,
    admin: <svg {...svg}><path d="M3 8l4-3 5 3 5-3 4 3v10l-4 3-5-3-5 3-4-3V8z" /></svg>,
    places: <svg {...svg}><circle cx="12" cy="10" r="3" /><path d="M12 21c4-5 8-8 8-12a8 8 0 1 0-16 0c0 4 4 7 8 12z" /></svg>,
    pois: <svg {...svg}><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" strokeDasharray="2 2" /></svg>,
};

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
                {LAYER_GROUPS.map((group) => {
                    const items = LAYER_META.filter((m) => m.category === group.id);
                    if (items.length === 0) return null;
                    return (
                        <section key={group.id} className="layer-group">
                            <h3 className="layer-group__title">{group.title}</h3>
                            <ul className="layer-list">
                                {items.map(({ key, title, description }) => (
                                    <li key={key}>
                                        <button
                                            type="button"
                                            className="layer-row"
                                            role="switch"
                                            aria-checked={layers[key]}
                                            onClick={() => onToggle(key)}
                                        >
                                            <span className="layer-row__icon">{ICONS[key] ?? <svg {...svg}><circle cx="12" cy="12" r="6" /></svg>}</span>
                                            <span className="layer-row__text">
                                                <span className="layer-row__title">{title}</span>
                                                <span className="layer-row__desc">{description}</span>
                                            </span>
                                            <span className={`layer-switch${layers[key] ? " is-on" : ""}`}>
                                                <span className="layer-switch__knob" />
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </aside>
    );
}