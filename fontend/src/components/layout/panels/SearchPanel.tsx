import { useEffect, useRef, useState } from "react";
import "../../sidebar/CoordSidebar/CoordSidebar.css";
import "./SearchPanel.css";

export interface SearchResult {
    id: string | number;
    name: string;
    category?: string | null;
    address?: string | null;
    lat: number;
    lng: number;
    source?: "osm" | "user";
}

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
    const onSearchRef = useRef(onSearch);
    onSearchRef.current = onSearch;

    // Auto-focus khi mở
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Debounce 300ms
    useEffect(() => {
        const timer = window.setTimeout(() => {
            onSearchRef.current?.(query.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    const hasQuery = query.trim().length > 0;
    const showEmpty = !hasQuery && !loading;
    const showNoResult = hasQuery && !loading && results.length === 0 && !error;

    return (
        <aside
            className="coord-sidebar"
            aria-label="Tìm kiếm"
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
            }}
        >
            <header className="coord-sidebar__header">
                <div>
                    <h2>Tìm kiếm</h2>
                    <p className="cs-muted">Tìm địa điểm trên bản đồ</p>
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

            <div className="search-panel__searchbar">
                <div className="search-panel__input-wrap">
                    <svg
                        className="search-panel__input-icon"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="search"
                        className="search-panel__input"
                        placeholder="Nhập tên địa điểm, đường phố..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Tìm kiếm trên bản đồ"
                    />
                    {query && (
                        <button
                            type="button"
                            className="search-panel__clear"
                            onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                            }}
                            aria-label="Xoá nội dung tìm kiếm"
                        >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="coord-sidebar__scroll">
                {error && (
                    <div className="cs-alert cs-alert--error" role="alert">
                        <span>{error}</span>
                    </div>
                )}

                {showEmpty && (
                    <p className="cs-muted">
                        Nhập tên địa điểm, đường phố hoặc địa chỉ để tìm trên bản đồ.
                    </p>
                )}

                {loading && (
                    <div className="search-panel__skeleton" aria-hidden="true">
                        {Array.from({ length: 4 }, (_, i) => (
                            <span key={i} className="search-panel__skeleton-line" />
                        ))}
                    </div>
                )}

                {showNoResult && (
                    <p className="cs-muted">
                        Không tìm thấy kết quả phù hợp. Thử từ khoá khác hoặc kiểm tra lại chính tả.
                    </p>
                )}

                {!loading && results.length > 0 && (
                    <ul className="search-panel__list">
                        {results.map((r) => (
                            <li
                                key={`${r.source ?? "osm"}-${r.id}`}
                                className="search-panel__item"
                            >
                                <button
                                    type="button"
                                    className="search-panel__result"
                                    onClick={() => onResultClick?.(r)}
                                >
                                    <span className="search-panel__result-icon">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                                            <circle cx="12" cy="10" r="2.5" />
                                        </svg>
                                    </span>
                                    <span className="search-panel__result-body">
                                        <span className="search-panel__result-name">
                                            {r.name || "Chưa đặt tên"}
                                        </span>
                                        {(r.category || r.address) && (
                                            <span className="search-panel__result-meta">
                                                {r.category && (
                                                    <span className="search-panel__result-cat">{r.category}</span>
                                                )}
                                                {r.address && (
                                                    <span className="search-panel__result-addr">{r.address}</span>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}