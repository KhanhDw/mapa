import { useCallback, useEffect, useRef, useState } from "react";
import { searchMap } from "../../api/search";
import type { SearchResult } from "../../components/layout/panels";

export function useMapSearch(activePanel: string | null) {
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const searchAbortController = useRef<AbortController | null>(null);

    const handleSearch = useCallback(async (query: string) => {
        searchAbortController.current?.abort();
        const trimmedQuery = query.trim();
        if (trimmedQuery.length < 2) {
            setSearchResults([]);
            setSearchError(null);
            setSearchLoading(false);
            return;
        }

        const controller = new AbortController();
        searchAbortController.current = controller;
        setSearchLoading(true);
        setSearchError(null);
        try {
            const results = await searchMap(trimmedQuery, controller.signal);
            if (!controller.signal.aborted) setSearchResults(results);
        } catch (error) {
            if (controller.signal.aborted) return;
            setSearchError(error instanceof Error ? error.message : "Không thể tìm kiếm");
            setSearchResults([]);
        } finally {
            if (!controller.signal.aborted) setSearchLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activePanel !== "search") {
            searchAbortController.current?.abort();
            searchAbortController.current = null;
        }
    }, [activePanel]);

    useEffect(() => () => searchAbortController.current?.abort(), []);

    return { searchResults, searchLoading, searchError, handleSearch };
}