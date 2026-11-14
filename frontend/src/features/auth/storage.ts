import type { User } from './types';

const STORAGE_KEY = 'forma.auth';

export interface PersistedAuth {
    user: User;
    token: string;
    expiresAt: number;
}

export function readPersistedAuth(): PersistedAuth | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedAuth;
        if (!parsed.token || !parsed.user) return null;
        if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function writePersistedAuth(value: PersistedAuth | null): void {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
}

export function getAuthToken(): string | null {
    return readPersistedAuth()?.token ?? null;
}