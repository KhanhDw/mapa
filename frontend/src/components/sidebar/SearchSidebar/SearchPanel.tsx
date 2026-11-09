import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "../../../api/search";
import "../CoordSidebar/CoordSidebar.css";
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

    useEffect(() => {
        const timer = window.setTimeout(() => {
            onSearch?.(query.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [onSearch, query]);

    const trimmedQuery = query.trim();
    const hasQuery = trimmedQuery.length > 0;
    const showEmpty = !hasQuery && !loading;
    const showShortQuery = hasQuery && trimmedQuery.length < 2 && !loading;
    const showNoResult =
        trimmedQuery.length >= 2 && !loading && results.length === 0 && !error;

    return (
        <aside
            className="coord-sidebar"
            aria-label="Tìm kiếm"
            onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
            }}
        >
            <header className="coord-sidebar__header">
                <div>
                    <h2>Tìm kiếm</h2>
                    <p className="cs-muted">Tìm địa điểm và đoạn đường trên bản đồ</p>
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
                        placeholder="Nhập tên địa điểm hoặc đường phố..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
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

                {showShortQuery && (
                    <p className="cs-muted">Nhập ít nhất 2 ký tự để tìm kiếm.</p>
                )}

                {loading && (
                    <div className="search-panel__skeleton" aria-hidden="true">
                        {Array.from({ length: 4 }, (_, index) => (
                            <span key={index} className="search-panel__skeleton-line" />
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
                        {results.map((result) => (
                            <li
                                key={`${result.kind}-${result.source}-${result.id}`}
                                className="search-panel__item"
                            >
                                <button
                                    type="button"
                                    className="search-panel__result"
                                    onClick={() => onResultClick?.(result)}
                                >
                                    <span className="search-panel__result-icon">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                            {result.kind === "road" ? (
                                                <path d="M4 20 20 4M8 20l4-4M12 12l4-4M4 16l4-4" strokeLinecap="round" />
                                            ) : (
                                                <>
                                                    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                                                    <circle cx="12" cy="10" r="2.5" />
                                                </>
                                            )}
                                        </svg>
                                    </span>
                                    <span className="search-panel__result-body">
                                        <span className="search-panel__result-name">
                                            {result.name || "Chưa đặt tên"}
                                        </span>
                                        <span className="search-panel__result-meta">
                                            <span className="search-panel__result-cat">
                                                {result.kind === "road"
                                                    ? "Đường"
                                                    : result.category || "Địa điểm"}
                                            </span>
                                            {result.address && (
                                                <span className="search-panel__result-addr">
                                                    {result.address}
                                                </span>
                                            )}
                                        </span>
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

export type { SearchResult } from "../../../api/search";
