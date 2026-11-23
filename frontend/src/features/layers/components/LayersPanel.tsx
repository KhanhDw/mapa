import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Building2,
    ChevronDown,
    Eye,
    EyeOff,
    Landmark,
    Layers3,
    MapPin,
    Navigation,
    RotateCcw,
    Route,
    Search,
    UserRound,
    X,
    Zap,
} from "lucide-react";

import "./LayersPanel.css";

import type { LayerKey, LayerVisibility } from "../../map/types/types";
import {
    DEFAULT_LAYER_KEYS,
    DEFAULT_LAYER_KEY_SET,
    LAYER_GROUPS,
    LAYER_META,
} from "../../map/components/EsriSatelliteMap/layers/registry";

interface Props {
    layers: LayerVisibility;
    onToggle: (key: LayerKey) => void;
    onBulkToggle?: (keys: LayerKey[], visible: boolean) => void;
    onClose: () => void;
}

type LayerMetaItem = (typeof LAYER_META)[number];
type FilterMode = "all" | "active" | "inactive";

const ICONS: Partial<Record<LayerKey, React.ReactNode>> = {
    streetview: <Navigation size={17} strokeWidth={1.8} />,
    roads: <Route size={17} strokeWidth={1.8} />,
    electric_poles: <Zap size={17} strokeWidth={1.8} />,
    buildings: <Building2 size={17} strokeWidth={1.8} />,
    admin: <Landmark size={17} strokeWidth={1.8} />,
    places: <MapPin size={17} strokeWidth={1.8} />,
    pois: <MapPin size={17} strokeWidth={2.1} />,
    userPois: <UserRound size={17} strokeWidth={1.8} />,
};

function matchesLayer(
    meta: LayerMetaItem,
    isActive: boolean,
    filterMode: FilterMode,
    normalizedQuery: string
): boolean {
    if (filterMode === "active" && !isActive) return false;
    if (filterMode === "inactive" && isActive) return false;
    if (!normalizedQuery) return true;

    const searchableText = [meta.title, meta.description, meta.key]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi");

    return searchableText.includes(normalizedQuery);
}

function HighlightText({ text, query }: { text: string; query: string }) {
    if (!query) return <>{text}</>;

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));

    return (
        <>
            {parts.map((part, i) =>
                part.toLocaleLowerCase("vi") === query ? (
                    <mark key={i} className="lp-highlight">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
}

export function LayersPanel({
    layers,
    onToggle,
    onBulkToggle,
    onClose,
}: Props) {
    const [query, setQuery] = useState("");
    const [filterMode, setFilterMode] = useState<FilterMode>("all");
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Phím tắt Ctrl+K / Cmd+K để focus ô tìm kiếm
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const totalCount = LAYER_META.length;
    const activeCount = useMemo(
        () => LAYER_META.filter((meta) => Boolean(layers[meta.key])).length,
        [layers]
    );
    const inactiveCount = totalCount - activeCount;
    const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

    const normalizedQuery = query.trim().toLocaleLowerCase("vi");

    const defaultMetas = useMemo(
        () =>
            DEFAULT_LAYER_KEYS.map((key) =>
                LAYER_META.find((meta) => meta.key === key)
            ).filter((meta): meta is LayerMetaItem => Boolean(meta)),
        []
    );

    const remainingMetas = useMemo(
        () => LAYER_META.filter((meta) => !DEFAULT_LAYER_KEY_SET.has(meta.key)),
        []
    );

    const filteredDefaults = useMemo(
        () =>
            defaultMetas.filter((meta) =>
                matchesLayer(meta, Boolean(layers[meta.key]), filterMode, normalizedQuery)
            ),
        [defaultMetas, layers, filterMode, normalizedQuery]
    );

    const filteredGroups = useMemo(() => {
        return LAYER_GROUPS.map((group) => {
            const groupItems = remainingMetas.filter(
                (meta) => meta.category === group.id
            );
            const activeInGroup = groupItems.filter((meta) =>
                Boolean(layers[meta.key])
            ).length;
            const visibleItems = groupItems.filter((meta) =>
                matchesLayer(meta, Boolean(layers[meta.key]), filterMode, normalizedQuery)
            );

            return {
                ...group,
                items: visibleItems,
                activeInGroup,
                total: groupItems.length,
            };
        }).filter((group) => group.items.length > 0);
    }, [remainingMetas, layers, filterMode, normalizedQuery]);

    const visibleItems = useMemo(
        () => [
            ...filteredDefaults,
            ...filteredGroups.flatMap((group) => group.items),
        ],
        [filteredDefaults, filteredGroups]
    );

    const visibleCount = visibleItems.length;
    const hasFilter = normalizedQuery.length > 0 || filterMode !== "all";

    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups((prev) => ({
            ...prev,
            [groupId]: !prev[groupId],
        }));
    };

    const handleBulkAction = (targetState: boolean) => {
        const targetKeys = visibleItems
            .filter((meta) => Boolean(layers[meta.key]) !== targetState)
            .map((meta) => meta.key);

        if (targetKeys.length === 0) return;

        if (onBulkToggle) {
            onBulkToggle(targetKeys, targetState);
        } else {
            targetKeys.forEach((key) => onToggle(key));
        }
    };

    const renderRow = (meta: LayerMetaItem) => {
        const isChecked = Boolean(layers[meta.key]);

        return (
            <li key={meta.key} className="lp-item">
                <button
                    type="button"
                    className={`lp-row ${isChecked ? "is-active" : ""}`}
                    role="switch"
                    aria-checked={isChecked}
                    aria-label={`${meta.title}: ${isChecked ? "Đang bật" : "Đang tắt"}`}
                    onClick={() => onToggle(meta.key)}
                >
                    <span
                        className={`lp-row__icon ${isChecked ? "is-active" : ""}`}
                        aria-hidden="true"
                    >
                        {ICONS[meta.key] ?? <Layers3 size={17} strokeWidth={1.8} />}
                    </span>

                    <span className="lp-row__content">
                        <span className="lp-row__title">
                            <HighlightText text={meta.title} query={normalizedQuery} />
                        </span>
                        {meta.description && (
                            <span className="lp-row__description">
                                <HighlightText
                                    text={meta.description}
                                    query={normalizedQuery}
                                />
                            </span>
                        )}
                    </span>

                    <span className="lp-row__state">
                        <span
                            className={`lp-switch ${isChecked ? "is-on" : ""}`}
                            aria-hidden="true"
                        >
                            <span className="lp-switch__thumb" />
                        </span>
                    </span>
                </button>
            </li>
        );
    };

    const defaultActiveCount = defaultMetas.filter((m) => Boolean(layers[m.key])).length;

    return (
        <aside
            className="coord-sidebar layers-panel"
            role="region"
            aria-label="Quản lý lớp bản đồ"
        >
            {/* 1. COMPACT HEADER */}
            <header className="lp-header">
                <div className="lp-header__text">
                    <h2>Quản lý lớp bản đồ</h2>
                    <p>Điều khiển dữ liệu hiển thị</p>
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

            {/* 2. LAYER STATISTICS */}
            <section className="lp-stats" aria-label="Thống kê lớp dữ liệu">
                <div className="lp-stat-card is-primary">
                    <span className="lp-stat-card__label">Đang bật</span>
                    <div className="lp-stat-card__value">
                        {String(activeCount).padStart(2, "0")}
                    </div>
                    <span className="lp-stat-card__sub">Lớp hoạt động</span>
                </div>

                <div className="lp-stat-card">
                    <span className="lp-stat-card__label">Tổng số</span>
                    <div className="lp-stat-card__value">
                        {String(totalCount).padStart(2, "0")}
                    </div>
                    <span className="lp-stat-card__sub">Lớp dữ liệu</span>
                </div>

                <div className="lp-stat-card">
                    <span className="lp-stat-card__label">Hiển thị</span>
                    <div className="lp-stat-card__value">{activePercent}%</div>
                    <span className="lp-stat-card__sub">Tỷ lệ bật</span>
                </div>
            </section>

            {/* 3. SEARCH & SEGMENTED FILTER */}
            <section className="lp-controls">
                <div className="lp-search">
                    <Search size={15} className="lp-search__icon" />
                    <input
                        ref={searchInputRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tìm kiếm lớp dữ liệu..."
                        aria-label="Tìm kiếm lớp dữ liệu"
                    />
                    {query ? (
                        <button
                            type="button"
                            className="lp-search__clear"
                            onClick={() => setQuery("")}
                            aria-label="Xóa từ khóa"
                        >
                            <X size={13} />
                        </button>
                    ) : (
                        <kbd className="lp-search__kbd" aria-hidden="true">
                            Ctrl K
                        </kbd>
                    )}
                </div>

                <div
                    className="lp-segmented"
                    role="tablist"
                    aria-label="Lọc trạng thái lớp"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={filterMode === "all"}
                        className={`lp-segmented__btn ${
                            filterMode === "all" ? "is-active" : ""
                        }`}
                        onClick={() => setFilterMode("all")}
                    >
                        Tất cả <span>{totalCount}</span>
                    </button>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={filterMode === "active"}
                        className={`lp-segmented__btn ${
                            filterMode === "active" ? "is-active" : ""
                        }`}
                        onClick={() => setFilterMode("active")}
                    >
                        Đang bật <span>{activeCount}</span>
                    </button>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={filterMode === "inactive"}
                        className={`lp-segmented__btn ${
                            filterMode === "inactive" ? "is-active" : ""
                        }`}
                        onClick={() => setFilterMode("inactive")}
                    >
                        Tắt <span>{inactiveCount}</span>
                    </button>
                </div>
            </section>

            {/* FILTER FEEDBACK */}
            {hasFilter && (
                <div className="lp-filter-bar">
                    <span>
                        Hiển thị <strong>{visibleCount}</strong> / {totalCount} lớp
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setFilterMode("all");
                        }}
                    >
                        <RotateCcw size={12} />
                        Đặt lại
                    </button>
                </div>
            )}

            {/* 4. LAYER GROUPS & ITEMS */}
            <div className="coord-sidebar__scroll lp-content">
                {filteredDefaults.length > 0 && (
                    <section className="lp-group">
                        <button
                            type="button"
                            className="lp-group__header"
                            onClick={() => toggleGroupCollapse("__default")}
                            aria-expanded={!collapsedGroups["__default"]}
                        >
                            <div className="lp-group__title">
                                <ChevronDown
                                    size={14}
                                    className={`lp-group__chevron ${
                                        collapsedGroups["__default"] ? "is-collapsed" : ""
                                    }`}
                                />
                                <h3>Lớp mặc định</h3>
                            </div>
                            <span className="lp-group__badge">
                                {defaultActiveCount}/{defaultMetas.length}
                            </span>
                        </button>

                        {!collapsedGroups["__default"] && (
                            <ul className="lp-list">{filteredDefaults.map(renderRow)}</ul>
                        )}
                    </section>
                )}

                {filteredGroups.map((group) => {
                    const isCollapsed = Boolean(collapsedGroups[group.id]);

                    return (
                        <section key={group.id} className="lp-group">
                            <button
                                type="button"
                                className="lp-group__header"
                                onClick={() => toggleGroupCollapse(group.id)}
                                aria-expanded={!isCollapsed}
                            >
                                <div className="lp-group__title">
                                    <ChevronDown
                                        size={14}
                                        className={`lp-group__chevron ${
                                            isCollapsed ? "is-collapsed" : ""
                                        }`}
                                    />
                                    <h3>{group.title}</h3>
                                </div>
                                <span className="lp-group__badge">
                                    {group.activeInGroup}/{group.total}
                                </span>
                            </button>

                            {!isCollapsed && (
                                <ul className="lp-list">{group.items.map(renderRow)}</ul>
                            )}
                        </section>
                    );
                })}

                {visibleCount === 0 && (
                    <div className="lp-empty">
                        <div className="lp-empty__icon">
                            {filterMode === "active" ? (
                                <EyeOff size={20} />
                            ) : (
                                <Search size={20} />
                            )}
                        </div>
                        <h3>Không tìm thấy lớp phù hợp</h3>
                        <p>
                            {hasFilter
                                ? "Không có lớp dữ liệu nào khớp với điều kiện lọc hiện tại."
                                : "Danh sách lớp dữ liệu hiện đang trống."}
                        </p>
                        {hasFilter && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    setFilterMode("all");
                                }}
                            >
                                Hiển thị tất cả lớp
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 5. ACTIONABLE FOOTER */}
            {visibleCount > 0 && (
                <footer className="lp-footer">
                    <button
                        type="button"
                        className="lp-footer__btn"
                        onClick={() => handleBulkAction(true)}
                        disabled={visibleItems.every((m) => Boolean(layers[m.key]))}
                    >
                        <Eye size={14} />
                        <span>{hasFilter ? "Bật mục đang lọc" : "Bật tất cả"}</span>
                    </button>

                    <button
                        type="button"
                        className="lp-footer__btn"
                        onClick={() => handleBulkAction(false)}
                        disabled={visibleItems.every((m) => !layers[m.key])}
                    >
                        <EyeOff size={14} />
                        <span>{hasFilter ? "Tắt mục đang lọc" : "Tắt tất cả"}</span>
                    </button>
                </footer>
            )}
        </aside>
    );
}