import { API_BASE } from '../../../config';
import type { User } from '../types';

export interface LoginPayload {
    email: string;
    password: string;
    rememberMe: boolean;
}

export interface RegisterPayload {
    fullName: string;
    email: string;
    password: string;
    agreeTerms: boolean;
}

export interface AuthResult {
    user: User;
    token: string;
    /** số giây token còn hiệu lực */
    expiresIn: number;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload.email, password: payload.password }),
    });
    if (!res.ok) throw new Error((await readError(res)) ?? 'Đăng nhập thất bại.');
    return normalize(await res.json(), payload.rememberMe);
}

export async function register(payload: RegisterPayload): Promise<AuthResult> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            full_name: payload.fullName,
            email: payload.email,
            password: payload.password,
        }),
    });
    if (!res.ok) throw new Error((await readError(res)) ?? 'Đăng ký thất bại.');
    return normalize(await res.json(), true);
}

export async function logout(): Promise<void> {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    } catch {
        /* không quan trọng – client vẫn xoá session */
    }
}

async function readError(res: Response): Promise<string | null> {
    try {
        const data = await res.json();
        return (data?.detail ?? data?.message ?? null) as string | null;
    } catch {
        return null;
    }
}

function normalize(raw: Record<string, unknown>, rememberMe: boolean): AuthResult {
    const u = (raw.user ?? raw) as Record<string, unknown>;
    const user: User = {
        id: String(u.id ?? ''),
        email: String(u.email ?? ''),
        fullName: String(u.full_name ?? u.fullName ?? ''),
        avatarUrl: (u.avatar_url ?? u.avatarUrl ?? undefined) as string | undefined,
    };
    const token = (raw.access_token ?? raw.token ?? '') as string;
    if (!token) throw new Error('Server không trả về token.');
    const expiresIn =
        (raw.expires_in as number) ??
        (rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 12);
    return { user, token, expiresIn };
}