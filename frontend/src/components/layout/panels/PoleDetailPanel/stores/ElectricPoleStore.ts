
import {
    createElectricPole,
    deleteElectricPole,
    getElectricPole,
    getElectricPoles,
    updateElectricPole,
} from "../../../../../api/electricPoles";

import type {
    ElectricPole,
    ElectricPoleInput,
    ElectricPoleListResponse,
} from "../../../../../api/electricPoles";

type Listener = () => void;

interface ElectricPoleState {
    poles: ElectricPole[];
    total: number;
    loading: boolean;
    error: string | null;
}

class ElectricPoleStore {
    private static instance: ElectricPoleStore;

    private state: ElectricPoleState = {
        poles: [],
        total: 0,
        loading: false,
        error: null,
    };

    private listeners = new Set<Listener>();

    // Ngăn khởi tạo instance từ bên ngoài
    private constructor() {}

    // Singleton instance
    public static getInstance(): ElectricPoleStore {
        if (!ElectricPoleStore.instance) {
            ElectricPoleStore.instance = new ElectricPoleStore();
        }

        return ElectricPoleStore.instance;
    }

    // Lấy state hiện tại
    public getSnapshot = (): ElectricPoleState => {
        return this.state;
    };

    // Đăng ký listener
    public subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    };

    // Thông báo cho các component
    private notify(): void {
        this.listeners.forEach((listener) => listener());
    }

    // Cập nhật state
    private setState(
        newState: Partial<ElectricPoleState>
    ): void {
        this.state = {
            ...this.state,
            ...newState,
        };

        this.notify();
    }

    // GET: Lấy danh sách trụ điện
    public async load(search?: string): Promise<ElectricPoleListResponse> {
        this.setState({
            loading: true,
            error: null,
        });

        try {
            const response = await getElectricPoles(search);

            this.setState({
                poles: response.items,
                total: response.total,
                loading: false,
            });

            return response;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Không thể tải danh sách trụ điện.";

            this.setState({
                loading: false,
                error: message,
            });

            throw error;
        }
    }

    // GET: Lấy chi tiết một trụ điện
    public async getById(poleId: number): Promise<ElectricPole> {
        return await getElectricPole(poleId);
    }

    // POST: Thêm trụ điện
    public async create(
        data: ElectricPoleInput
    ): Promise<ElectricPole> {
        const result = await createElectricPole(data);

        await this.load();

        return result;
    }

    // PUT: Cập nhật trụ điện
    public async update(
        poleId: number,
        data: ElectricPoleInput
    ): Promise<ElectricPole> {
        const result = await updateElectricPole(poleId, data);

        await this.load();

        return result;
    }

    // DELETE: Xóa trụ điện
    public async delete(poleId: number): Promise<void> {
        await deleteElectricPole(poleId);

        await this.load();
    }

    // Reset state
    public clear(): void {
        this.setState({
            poles: [],
            total: 0,
            loading: false,
            error: null,
        });
    }
}

// Export duy nhất một instance
export const electricPoleStore =
    ElectricPoleStore.getInstance();
