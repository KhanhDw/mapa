
import { useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    ArrowUpRight,
    Clock3,
    MapPin,
    Route,
    Search,
    Sparkles,
    X,
} from "lucide-react";

import type { SearchResult } from "../../../../api/search";
import "../generalPanel/generalPanel.css";
import "./SearchPanel.css";

interface Props {
    onClose: () => void;
    results?: SearchResult[];
    loading?: boolean;
    error?: string | null;
    onSearch?: (query: string) => void;
    onResultClick?: (result: SearchResult) => void;
}

export function SearchPanel({
    onClose,
    results = [],
    loading = false,
    error = null,
    onSearch,
    onResultClick,
}: Props) {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Debounce tìm kiếm, tránh gọi API liên tục khi người dùng nhập.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            onSearch?.(query.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [onSearch, query]);

    const trimmedQuery = query.trim();
    const hasQuery = trimmedQuery.length > 0;

    const showEmpty = !hasQuery && !loading && !error;
    const showShortQuery =
        hasQuery && trimmedQuery.length < 2 && !loading && !error;

    const showNoResult =
        trimmedQuery.length >= 2 &&
        !loading &&
        results.length === 0 &&
        !error;

    const handleClear = () => {
        setQuery("");
        inputRef.current?.focus();
    };

    const handleResultClick = (result: SearchResult) => {
        onResultClick?.(result);
    };

    return (
        <aside
            className="coord-sidebar search-panel"
            aria-label="Tìm kiếm trên bản đồ"
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    onClose();
                }
            }}
        >
            {/* Header */}
            <header className="search-panel__header">
                <div className="search-panel__heading">
                    <div className="search-panel__heading-icon">
                        <MapPin size={19} strokeWidth={2} />
                    </div>

                    <div className="search-panel__heading-content">
                        <div className="search-panel__title-row">
                            <h2>Tìm kiếm</h2>
                            <span className="search-panel__status">
                                <span className="search-panel__status-dot" />
                                Bản đồ
                            </span>
                        </div>

                        <p>Tìm địa điểm và tuyến đường</p>
                    </div>
                </div>

                <button
                    type="button"
                    className="search-panel__close"
                    onClick={onClose}
                    aria-label="Đóng bảng tìm kiếm"
                    title="Đóng"
                >
                    <X size={18} />
                </button>
            </header>

            {/* Search input */}
            <div className="search-panel__search-area">
                <label
                    className="search-panel__label"
                    htmlFor="map-search-input"
                >
                    Từ khóa tìm kiếm
                </label>

                <div
                    className={`search-panel__input-wrap ${hasQuery ? "is-filled" : ""
                        }`}
                >
                    <Search
                        className="search-panel__input-icon"
                        size={18}
                        strokeWidth={2}
                    />

                    <input
                        ref={inputRef}
                        id="map-search-input"
                        type="search"
                        className="search-panel__input"
                        placeholder="Tên địa điểm, đường phố..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        aria-label="Tìm kiếm địa điểm hoặc đường phố"
                        autoComplete="off"
                    />

                    {query && (
                        <button
                            type="button"
                            className="search-panel__clear"
                            onClick={handleClear}
                            aria-label="Xóa nội dung tìm kiếm"
                            title="Xóa tìm kiếm"
                        >
                            <X size={15} />
                        </button>
                    )}

                    {!query && (
                        <kbd className="search-panel__shortcut">ESC</kbd>
                    )}
                </div>

                <p className="search-panel__hint">
                    <Sparkles size={13} />
                    Nhập từ khóa để tìm kiếm trên bản đồ
                </p>
            </div>

            {/* Results */}
            <div className="coord-sidebar__scroll search-panel__content">
                {error && (
                    <div
                        className="search-panel__error"
                        role="alert"
                    >
                        <div className="search-panel__message-icon">
                            <AlertCircle size={17} />
                        </div>

                        <div>
                            <strong>Không thể tìm kiếm</strong>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {/* Initial state */}
                {showEmpty && (
                    <div className="search-panel__empty">
                        <div className="search-panel__empty-visual">
                            <div className="search-panel__empty-circle search-panel__empty-circle--outer" />
                            <div className="search-panel__empty-circle search-panel__empty-circle--inner" />

                            <div className="search-panel__empty-icon">
                                <Search size={28} strokeWidth={1.7} />
                            </div>

                            <span className="search-panel__empty-pin">
                                <MapPin size={17} />
                            </span>
                        </div>

                        <h3>Bắt đầu tìm kiếm</h3>

                        <p>
                            Nhập tên địa điểm, địa chỉ hoặc tuyến đường
                            để xem kết quả trên bản đồ.
                        </p>

                        <div className="search-panel__suggestion">
                            <span className="search-panel__suggestion-icon">
                                <MapPin size={15} />
                            </span>
                            <span>Ví dụ: Bưu điện, bệnh viện, trường học...</span>
                        </div>

                        <div className="search-panel__suggestion">
                            <span className="search-panel__suggestion-icon">
                                <Route size={15} />
                            </span>
                            <span>Ví dụ: Nguyễn Huệ, Trần Hưng Đạo...</span>
                        </div>
                    </div>
                )}

                {/* Short query */}
                {showShortQuery && (
                    <div className="search-panel__notice">
                        <Search size={17} />
                        <span>Nhập ít nhất 2 ký tự để tìm kiếm.</span>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div
                        className="search-panel__loading"
                        aria-label="Đang tìm kiếm"
                        aria-live="polite"
                    >
                        <div className="search-panel__loading-heading">
                            <span className="search-panel__loading-spinner" />
                            <span>Đang tìm kiếm...</span>
                        </div>

                        {Array.from({ length: 5 }, (_, index) => (
                            <div
                                key={index}
                                className="search-panel__skeleton"
                            >
                                <span className="search-panel__skeleton-icon" />

                                <span className="search-panel__skeleton-body">
                                    <span className="search-panel__skeleton-line search-panel__skeleton-line--title" />
                                    <span className="search-panel__skeleton-line search-panel__skeleton-line--meta" />
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* No results */}
                {showNoResult && (
                    <div className="search-panel__no-result">
                        <div className="search-panel__no-result-icon">
                            <Search size={23} />
                        </div>

                        <h3>Không tìm thấy kết quả</h3>

                        <p>
                            Không có địa điểm hoặc tuyến đường phù hợp với
                            từ khóa <strong>“{trimmedQuery}”</strong>.
                        </p>

                        <button
                            type="button"
                            className="search-panel__retry"
                            onClick={() => inputRef.current?.focus()}
                        >
                            Thử từ khóa khác
                            <ArrowUpRight size={15} />
                        </button>
                    </div>
                )}

                {/* Result list */}
                {!loading && results.length > 0 && (
                    <section className="search-panel__results">
                        <div className="search-panel__results-heading">
                            <div>
                                <h3>Kết quả tìm kiếm</h3>
                                <p>Các vị trí phù hợp với từ khóa</p>
                            </div>

                            <span className="search-panel__count">
                                {results.length}
                            </span>
                        </div>

                        <ul className="search-panel__list">
                            {results.map((result) => {
                                const isRoad = result.kind === "road";

                                return (
                                    <li
                                        key={`${result.kind}-${result.source}-${result.id}`}
                                        className="search-panel__item"
                                    >
                                        <button
                                            type="button"
                                            className="search-panel__result"
                                            onClick={() =>
                                                handleResultClick(result)
                                            }
                                        >
                                            <span
                                                className={`search-panel__result-icon ${isRoad
                                                    ? "search-panel__result-icon--road"
                                                    : "search-panel__result-icon--place"
                                                    }`}
                                            >
                                                {isRoad ? (
                                                    <Route
                                                        size={19}
                                                        strokeWidth={1.9}
                                                    />
                                                ) : (
                                                    <MapPin
                                                        size={19}
                                                        strokeWidth={1.9}
                                                    />
                                                )}
                                            </span>

                                            <span className="search-panel__result-body">
                                                <span className="search-panel__result-name">
                                                    {result.name || "Chưa đặt tên"}
                                                </span>

                                                <span className="search-panel__result-meta">
                                                    <span
                                                        className={`search-panel__result-cat ${isRoad
                                                            ? "is-road"
                                                            : ""
                                                            }`}
                                                    >
                                                        {isRoad
                                                            ? "Tuyến đường"
                                                            : result.category ||
                                                            "Địa điểm"}
                                                    </span>

                                                    {result.address && (
                                                        <span className="search-panel__result-addr">
                                                            {result.address}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>

                                            <span className="search-panel__result-action">
                                                <ArrowUpRight size={16} />
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
            </div>

            {/* Footer */}
            <footer className="search-panel__footer">
                <div className="search-panel__footer-left">
                    <span className="search-panel__footer-indicator" />
                    <span>Hệ thống bản đồ</span>
                </div>

                <div className="search-panel__footer-right">
                    <Clock3 size={13} />
                    <span>Tìm kiếm trực tuyến</span>
                </div>
            </footer>
        </aside>
    );
}

export type { SearchResult } from "../../../../api/search";
