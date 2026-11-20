import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchResult } from "../../api/search";
import { searchMap } from "../../api/search";

export function useMapSearch(activePanel: string | null) {
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const searchRequestId = useRef(0);

    const handleSearch = useCallback(async (query: string) => {
        const trimmedQuery = query.trim();
        const requestId = ++searchRequestId.current;

        if (trimmedQuery.length < 2) {
            setSearchResults([]);
            setSearchError(null);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);
        setSearchError(null);

        try {
            const response = await searchMap(trimmedQuery);

            // Chỉ cập nhật nếu đây là request mới nhất
            if (requestId === searchRequestId.current) {
                setSearchResults(response.results);
            }
        } catch (error: unknown) {
            if (requestId !== searchRequestId.current) return;

            setSearchError(
                error instanceof Error
                    ? error.message
                    : "Không thể tìm kiếm"
            );

            setSearchResults([]);
        } finally {
            if (requestId === searchRequestId.current) {
                setSearchLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (activePanel !== "search") {
            searchRequestId.current++;

            setSearchLoading(false);
            setSearchError(null);
            setSearchResults([]);
        }
    }, [activePanel]);

    useEffect(() => {
        return () => {
            searchRequestId.current++;
        };
    }, []);

    return {
        searchResults,
        searchLoading,
        searchError,
        handleSearch,
    };
}