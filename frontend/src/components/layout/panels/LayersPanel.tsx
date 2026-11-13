import "./generalPanel/generalPanel.css";
import "./LayersPanel.css";
import type { ReactNode } from "react";
import type { LayerKey, LayerVisibility } from "./types";
import {
    DEFAULT_LAYER_KEYS,
    DEFAULT_LAYER_KEY_SET,
    LAYER_GROUPS,
    LAYER_META,
} from "../../maps/EsriSatelliteMap/layers/registry";

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

const ICONS: Partial<Record<LayerKey, ReactNode>> = {
    streetview: (
        <svg {...svg}>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 19c1.5-3.5 4.2-5 7-5s5.5 1.5 7 5" />
            <path d="M2 12c2.5 1.5 6 2.2 10 2.2s7.5-.7 10-2.2" strokeDasharray="2 2" />
        </svg>
    ),
    roads: (
        <svg {...svg}>
            <path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" />
        </svg>
    ),
    roadNames: (
        <svg {...svg}>
            <path d="M5 19L12 5l7 14M7.5 14h9" />
        </svg>
    ),
    roadsMajor: (
        <svg {...svg}>
            <path d="M4 20L12 4l8 16M8 14h8" />
        </svg>
    ),
    roadsMinor: (
        <svg {...svg}>
            <path d="M6 20L12 8l6 12" />
        </svg>
    ),
    roadsLocal: (
        <svg {...svg}>
            <path d="M8 20L12 10l4 10" />
        </svg>
    ),
    railways: (
        <svg {...svg}>
            <path d="M6 4v16M18 4v16M6 8h12M6 12h12M6 16h12" />
        </svg>
    ),
    water: (
        <svg {...svg}>
            <path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        </svg>
    ),
    waterways: (
        <svg {...svg}>
            <path d="M3 8c3 0 3 4 6 4s3-4 6-4 3 4 6 4M3 16c3 0 3 4 6 4s3-4 6-4 3 4 6 4" />
        </svg>
    ),
    landuse: (
        <svg {...svg}>
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="8" rx="1" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
    ),
    natural: (
        <svg {...svg}>
            <path d="M12 3l4 6-4 2-4-2 4-6zM8 13l4-2 4 2-4 8-4-8z" />
        </svg>
    ),
    protected: (
        <svg {...svg}>
            <path d="M12 3l8 4v6c0 5-4 8-8 8s-8-3-8-8V7l8-4z" />
        </svg>
    ),
    buildings: (
        <svg {...svg}>
            <rect x="4" y="6" width="16" height="14" rx="1" />
            <path d="M9 6V3h6v3M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
        </svg>
    ),
    admin: (
        <svg {...svg}>
            <path d="M3 8l4-3 5 3 5-3 4 3v10l-4 3-5-3-5 3-4-3V8z" />
        </svg>
    ),
    places: (
        <svg {...svg}>
            <circle cx="12" cy="10" r="3" />
            <path d="M12 21c4-5 8-8 8-12a8 8 0 1 0-16 0c0 4 4 7 8 12z" />
        </svg>
    ),
    pois: (
        <svg {...svg}>
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="9" strokeDasharray="2 2" />
        </svg>
    ),
    userPois: (
        <svg {...svg}>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
        </svg>
    ),
};

type LayerMetaItem = (typeof LAYER_META)[number];

export function LayersPanel({ layers, onToggle, onClose }: Props) {
    const activeCount = LAYER_META.filter((m) => layers[m.key]).length;

    // 5 lớp mặc định, đúng thứ tự: streetview, roads, roadNames, pois, userPois
    const defaultMetas = DEFAULT_LAYER_KEYS
        .map((key) => LAYER_META.find((m) => m.key === key))
        .filter((m): m is LayerMetaItem => Boolean(m));

    // Các lớp còn lại (không nằm trong nhóm mặc định)
    const remainingMetas = LAYER_META.filter(
        (m) => !DEFAULT_LAYER_KEY_SET.has(m.key),
    );

    const renderRow = ({ key, title, description }: LayerMetaItem) => {
        const isChecked = Boolean(layers[key]);
        return (
            <li key={key}>
                <button
                    type="button"
                    className="layer-row"
                    role="switch"
                    aria-checked={isChecked}
                    onClick={() => onToggle(key)}
                >
                    <span className="layer-row__icon">
                        {ICONS[key] ?? (
                            <svg {...svg}>
                                <circle cx="12" cy="12" r="6" />
                            </svg>
                        )}
                    </span>
                    <span className="layer-row__text">
                        <span className="layer-row__title">{title}</span>
                        <span className="layer-row__desc">{description}</span>
                    </span>
                    <span
                        className={`layer-switch${isChecked ? " is-on" : ""}`}
                        aria-hidden="true"
                    >
                        <span className="layer-switch__knob" />
                    </span>
                </button>
            </li>
        );
    };

    return (
        <div
            className="coord-sidebar layers-panel"
            role="region"
            aria-label="Lớp bản đồ"
        >
            <header className="coord-sidebar__header">
                <div>
                    <h2>Lớp bản đồ</h2>
                    <p className="cs-muted">
                        Đang bật <strong>{activeCount}</strong>/{LAYER_META.length} lớp hiển thị
                    </p>
                </div>
                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng"
                    title="Đóng bảng lớp bản đồ"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            fill="none"
                        />
                    </svg>
                </button>
            </header>

            <div className="coord-sidebar__scroll">
                {/* Nhóm 5 lớp mặc định, luôn đứng đầu */}
                {defaultMetas.length > 0 && (
                    <section className="layer-group layer-group--default">
                        <h3 className="layer-group__title">Lớp mặc định</h3>
                        <ul className="layer-list">
                            {defaultMetas.map(renderRow)}
                        </ul>
                    </section>
                )}

                {/* Các nhóm còn lại */}
                {LAYER_GROUPS.map((group) => {
                    const items = remainingMetas.filter(
                        (m) => m.category === group.id,
                    );
                    if (items.length === 0) return null;
                    return (
                        <section key={group.id} className="layer-group">
                            <h3 className="layer-group__title">{group.title}</h3>
                            <ul className="layer-list">
                                {items.map(renderRow)}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}