
import {
    useCallback,
    useSyncExternalStore,
} from "react";

import { electricPoleStore } from "../stores/ElectricPoleStore";


import type {
    ElectricPoleInput,
    ElectricPoleQuery,
} from "../../../../../api/electricPoles";
export function useElectricPoles() {
    // Subscribe Singleton Store
    const state = useSyncExternalStore(
        electricPoleStore.subscribe,
        electricPoleStore.getSnapshot,
        electricPoleStore.getSnapshot
    );

    // Tải danh sách trụ điện
    const refresh = useCallback(
    (query?: ElectricPoleQuery) => {
        return electricPoleStore.load(query);
    },
    []
);

    // Lấy chi tiết trụ điện
    const getById = useCallback(
        (poleId: number) => {
            return electricPoleStore.getById(poleId);
        },
        []
    );

    // Thêm trụ điện
    const createPole = useCallback(
        (data: ElectricPoleInput) => {
            return electricPoleStore.create(data);
        },
        []
    );

    // Cập nhật trụ điện
    const updatePole = useCallback(
        (poleId: number, data: ElectricPoleInput) => {
            return electricPoleStore.update(poleId, data);
        },
        []
    );

    // Xóa trụ điện
    const deletePole = useCallback(
        (poleId: number) => {
            return electricPoleStore.delete(poleId);
        },
        []
    );

    return {
        // State
        poles: state.poles,
        total: state.total,
        loading: state.loading,
        error: state.error,

        // Actions
        refresh,
        getById,
        createPole,
        updatePole,
        deletePole,
    };
}
