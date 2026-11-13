
import { useMemo, useState } from "react";
import {
    Activity,
    Check,
    Eye,
    EyeOff,
    Layers3,
    Map,
    MapPin,
    Route,
    Search,
    SlidersHorizontal,
    TrainFront,
    Trees,
    Waves,
    X,
    Building2,
    Shield,
    Navigation,
    Tag,
    UserRound,
} from "lucide-react";

import "./generalPanel/generalPanel.css";
import "./LayersPanel.css";

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

type LayerMetaItem = (typeof LAYER_META)[number];

const ICONS: Partial<Record<LayerKey, React.ReactNode>> = {
    streetview: <Navigation size={19} strokeWidth={1.8} />,
    roads: <Route size={19} strokeWidth={1.8} />,
    roadNames: <Tag size={19} strokeWidth={1.8} />,
    roadsMajor: <Route size={19} strokeWidth={2.3} />,
    roadsMinor: <Route size={18} strokeWidth={1.6} />,
    roadsLocal: <Navigation size={18} strokeWidth={1.7} />,
    railways: <TrainFront size={19} strokeWidth={1.8} />,
    water: <Waves size={19} strokeWidth={1.8} />,
    waterways: <Waves size={19} strokeWidth={1.8} />,
    landuse: <Map size={19} strokeWidth={1.8} />,
    natural: <Trees size={19} strokeWidth={1.8} />,
    protected: <Shield size={19} strokeWidth={1.8} />,
    buildings: <Building2 size={19} strokeWidth={1.8} />,
    admin: <Map size={19} strokeWidth={1.8} />,
    places: <MapPin size={19} strokeWidth={1.8} />,
    pois: <MapPin size={19} strokeWidth={2.2} />,
    userPois: <UserRound size={19} strokeWidth={1.8} />,
};

export function LayersPanel({
    layers,
    onToggle,
    onClose,
}: Props) {
    const [query, setQuery] = useState("");
    const [activeOnly, setActiveOnly] = useState(false);

    const activeCount = LAYER_META.filter(
        (meta) => Boolean(layers[meta.key])
    ).length;

    const totalCount = LAYER_META.length;

    const progress = totalCount > 0
        ? (activeCount / totalCount) * 100
        : 0;

    const normalizedQuery = query.trim().toLocaleLowerCase("vi");

    // Giữ thứ tự 5 lớp mặc định như registry hiện tại.
    const defaultMetas = useMemo(
        () =>
            DEFAULT_LAYER_KEYS
                .map((key) =>
                    LAYER_META.find((meta) => meta.key === key)
                )
                .filter(
                    (meta): meta is LayerMetaItem => Boolean(meta)
                ),
        []
    );

    const remainingMetas = useMemo(
        () =>
            LAYER_META.filter(
                (meta) => !DEFAULT_LAYER_KEY_SET.has(meta.key)
            ),
        []
    );

    const filterMetas = (items: LayerMetaItem[]) => {
        return items.filter((meta) => {
            const isActive = Boolean(layers[meta.key]);

            if (activeOnly && !isActive) {
                return false;
            }

            if (!normalizedQuery) {
                return true;
            }

            const searchableText = [
                meta.title,
                meta.description,
                meta.key,
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("vi");

            return searchableText.includes(normalizedQuery);
        });
    };

    const filteredDefaults = filterMetas(defaultMetas);

    const filteredGroups = useMemo(() => {
        return LAYER_GROUPS.map((group) => {
            const items = remainingMetas.filter(
                (meta) => meta.category === group.id
            );

            return {
                ...group,
                items: filterMetas(items),
                total: items.length,
            };
        }).filter((group) => group.items.length > 0);
    }, [remainingMetas, normalizedQuery, activeOnly, layers]);

    const visibleCount =
        filteredDefaults.length +
        filteredGroups.reduce(
            (sum, group) => sum + group.items.length,
            0
        );

    const hasFilter = normalizedQuery.length > 0 || activeOnly;

    const renderRow = (meta: LayerMetaItem) => {
        const isChecked = Boolean(layers[meta.key]);

        return (
            <li
                key={meta.key}
                className="lp-item"
            >
                <button
                    type="button"
                    className={`lp-row ${isChecked ? "is-active" : ""}`}
                    role="switch"
                    aria-checked={isChecked}
                    aria-label={`${meta.title}: ${isChecked ? "Đang bật" : "Đang tắt"
                        }`}
                    onClick={() => onToggle(meta.key)}
                >
                    <span
                        className={`lp-row__icon ${isChecked ? "is-active" : ""
                            }`}
                        aria-hidden="true"
                    >
                        {ICONS[meta.key] ?? (
                            <Layers3 size={19} strokeWidth={1.8} />
                        )}
                    </span>

                    <span className="lp-row__content">
                        <span className="lp-row__title">
                            {meta.title}
                        </span>

                        <span className="lp-row__description">
                            {meta.description}
                        </span>
                    </span>

                    <span className="lp-row__state">
                        <span
                            className={`lp-switch ${isChecked ? "is-on" : ""
                                }`}
                            aria-hidden="true"
                        >
                            <span className="lp-switch__thumb">
                                {isChecked && (
                                    <Check size={10} strokeWidth={3} />
                                )}
                            </span>
                        </span>
                    </span>
                </button>
            </li>
        );
    };

    return (
        <aside
            className="coord-sidebar layers-panel"
            role="region"
            aria-label="Quản lý lớp bản đồ"
        >
            {/* HEADER */}
            <header className="lp-header">
                <div className="lp-header__main">
                    <div className="lp-header__icon">
                        <Layers3 size={21} strokeWidth={1.8} />
                    </div>

                    <div className="lp-header__text">
                        <div className="lp-header__title-row">
                            <h2>Lớp bản đồ</h2>

                            <span className="lp-header__badge">
                                <Activity size={11} />
                                Layers
                            </span>
                        </div>

                        <p>Quản lý dữ liệu hiển thị trên bản đồ</p>
                    </div>
                </div>

                <button
                    type="button"
                    className="lp-close"
                    onClick={onClose}
                    aria-label="Đóng bảng lớp bản đồ"
                    title="Đóng"
                >
                    <X size={18} />
                </button>
            </header>

            {/* OVERVIEW */}
            <section className="lp-overview">
                <div className="lp-overview__top">
                    <div className="lp-overview__label">
                        <span className="lp-overview__dot" />
                        Lớp đang hiển thị
                    </div>

                    <div className="lp-overview__count">
                        <strong>{activeCount}</strong>
                        <span>/ {totalCount}</span>
                    </div>
                </div>

                <div
                    className="lp-progress"
                    role="progressbar"
                    aria-label="Tỷ lệ lớp bản đồ đang bật"
                    aria-valuemin={0}
                    aria-valuemax={totalCount}
                    aria-valuenow={activeCount}
                >
                    <span
                        className="lp-progress__bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="lp-overview__bottom">
                    <span>
                        {activeCount === 0
                            ? "Chưa có lớp nào được bật"
                            : `${activeCount} lớp đang hoạt động`}
                    </span>

                    <span>
                        {Math.round(progress)}%
                    </span>
                </div>
            </section>

            {/* SEARCH */}
            <section className="lp-toolbar">
                <div className="lp-search">
                    <Search
                        size={17}
                        className="lp-search__icon"
                    />

                    <input
                        type="search"
                        value={query}
                        onChange={(event) =>
                            setQuery(event.target.value)
                        }
                        placeholder="Tìm lớp bản đồ..."
                        aria-label="Tìm lớp bản đồ"
                    />

                    {query && (
                        <button
                            type="button"
                            className="lp-search__clear"
                            onClick={() => setQuery("")}
                            aria-label="Xóa tìm kiếm"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className={`lp-filter ${activeOnly ? "is-active" : ""
                        }`}
                    onClick={() => setActiveOnly((value) => !value)}
                    aria-pressed={activeOnly}
                    title={
                        activeOnly
                            ? "Hiển thị tất cả lớp"
                            : "Chỉ hiển thị lớp đang bật"
                    }
                >
                    <SlidersHorizontal size={16} />
                    <span>
                        {activeOnly ? "Đang bật" : "Bộ lọc"}
                    </span>
                </button>
            </section>

            {/* FILTER SUMMARY */}
            {hasFilter && (
                <div className="lp-filter-summary">
                    <span>
                        Tìm thấy <strong>{visibleCount}</strong> lớp
                    </span>

                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setActiveOnly(false);
                        }}
                    >
                        Xóa bộ lọc
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* LAYER LIST */}
            <div className="coord-sidebar__scroll lp-content">
                {!hasFilter && (
                    <div className="lp-section-intro">
                        <span className="lp-section-intro__icon">
                            <Eye size={15} />
                        </span>

                        <span>
                            Bật hoặc tắt các lớp dữ liệu muốn hiển thị
                        </span>
                    </div>
                )}

                {/* DEFAULT LAYERS */}
                {filteredDefaults.length > 0 && (
                    <section className="lp-group lp-group--default">
                        <div className="lp-group__heading">
                            <div className="lp-group__heading-left">
                                <span className="lp-group__marker lp-group__marker--primary" />
                                <h3>Lớp mặc định</h3>
                            </div>

                            <span className="lp-group__count">
                                {filteredDefaults.length}
                            </span>
                        </div>

                        <ul className="lp-list">
                            {filteredDefaults.map(renderRow)}
                        </ul>
                    </section>
                )}

                {/* OTHER GROUPS */}
                {filteredGroups.map((group) => (
                    <section
                        key={group.id}
                        className="lp-group"
                    >
                        <div className="lp-group__heading">
                            <div className="lp-group__heading-left">
                                <span className="lp-group__marker" />
                                <h3>{group.title}</h3>
                            </div>

                            <span className="lp-group__count">
                                {group.items.length}
                            </span>
                        </div>

                        <ul className="lp-list">
                            {group.items.map(renderRow)}
                        </ul>
                    </section>
                ))}

                {/* NO RESULTS */}
                {visibleCount === 0 && (
                    <div className="lp-empty">
                        <div className="lp-empty__icon">
                            {activeOnly ? (
                                <EyeOff size={23} />
                            ) : (
                                <Search size={23} />
                            )}
                        </div>

                        <h3>
                            {activeOnly
                                ? "Không có lớp đang bật"
                                : "Không tìm thấy lớp"}
                        </h3>

                        <p>
                            {activeOnly
                                ? "Hiện tại không có lớp nào phù hợp với bộ lọc."
                                : "Thử tìm kiếm bằng tên hoặc mô tả khác."}
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                setActiveOnly(false);
                            }}
                        >
                            Hiển thị tất cả lớp
                        </button>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <footer className="lp-footer">
                <div className="lp-footer__left">
                    <span className="lp-footer__status" />
                    <span>Dữ liệu bản đồ</span>
                </div>

                <div className="lp-footer__right">
                    <span>{visibleCount} lớp hiển thị</span>
                </div>
            </footer>
        </aside>
    );
}
