
import { API_BASE } from '../../../core/config';
import type { User } from '../types';

export interface LoginPayload {
    /** Username hoặc email */
    email: string;
    password: string;
    rememberMe: boolean;
}

export interface RegisterPayload {
    username: string;
    fullName: string;
    email: string;
    password: string;
    agreeTerms: boolean;
}

export interface AuthResult {
    user: User;
    token: string;
    /** Số giây token còn hiệu lực */
    expiresIn: number;
}

interface LoginResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: {
        id: number;
        username: string;
        email: string;
        display_name: string | null;
        role: string;
        is_active: boolean;
        created_at: string;
    };
}

interface RegisterResponse {
    id: number;
    username: string;
    email: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            identifier: payload.email.trim(),
            password: payload.password,
        }),
    });

    if (!res.ok) {
        throw new Error(
            (await readError(res)) ?? 'Đăng nhập thất bại.',
        );
    }

    const data = (await res.json()) as LoginResponse;

    return normalizeLogin(data);
}

export async function register(
    payload: RegisterPayload,
): Promise<AuthResult> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: payload.username.trim(),
            email: payload.email.trim(),
            password: payload.password,
            display_name: payload.fullName.trim() || null,
        }),
    });

    if (!res.ok) {
        throw new Error(
            (await readError(res)) ?? 'Đăng ký thất bại.',
        );
    }

    // Backend trả UserOut, không trả JWT.
    // Parse response để xác nhận contract đăng ký.
    await res.json() as RegisterResponse;

    // Đăng ký thành công: đăng nhập ngay bằng username vừa tạo.
    return login({
        email: payload.username.trim(),
        password: payload.password,
        rememberMe: true,
    });
}

export async function logout(): Promise<void> {
    // Backend hiện chưa khai báo endpoint /logout.
    // Session được xóa ở AuthContext bằng writePersistedAuth(null).
}

async function readError(res: Response): Promise<string | null> {
    try {
        const data = await res.json();
        return (data?.detail ?? data?.message ?? null) as string | null;
    } catch {
        return null;
    }
}

function normalizeLogin(raw: LoginResponse): AuthResult {
    if (!raw.access_token) {
        throw new Error('Server không trả về access_token.');
    }

    if (
        typeof raw.expires_in !== 'number' ||
        !Number.isFinite(raw.expires_in) ||
        raw.expires_in <= 0
    ) {
        throw new Error('Thời hạn access_token không hợp lệ.');
    }

    if (!raw.user || raw.user.id == null) {
        throw new Error('Server không trả về thông tin người dùng hợp lệ.');
    }

    const user: User = {
        id: String(raw.user.id),
        email: raw.user.email,
        fullName: raw.user.display_name ?? raw.user.username,
    };

    return {
        user,
        token: raw.access_token,
        expiresIn: raw.expires_in,
    };
}
