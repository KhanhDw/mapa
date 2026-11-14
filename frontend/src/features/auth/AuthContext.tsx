import {
    createContext,
    useCallback,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import type { User } from './types';
import { readPersistedAuth, writePersistedAuth } from './storage';
import * as authApi from './api/auth';

export interface AuthContextValue {
    user: User | null;
    token: string | null;
    signingIn: boolean;
    signingUp: boolean;
    error: string | null;
    signIn: (payload: authApi.LoginPayload) => Promise<void>;
    signUp: (payload: authApi.RegisterPayload) => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function getInitial(): { user: User | null; token: string | null } {
    const p = readPersistedAuth();
    return { user: p?.user ?? null, token: p?.token ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [initial] = useState(getInitial);
    const [user, setUser] = useState<User | null>(initial.user);
    const [token, setToken] = useState<string | null>(initial.token);
    const [signingIn, setSigningIn] = useState(false);
    const [signingUp, setSigningUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const persistSession = useCallback((result: authApi.AuthResult) => {
        writePersistedAuth({
            user: result.user,
            token: result.token,
            expiresAt: Date.now() + result.expiresIn * 1000,
        });
        setUser(result.user);
        setToken(result.token);
    }, []);

    const signIn = useCallback<AuthContextValue['signIn']>(
        async (payload) => {
            setSigningIn(true);
            setError(null);
            try {
                persistSession(await authApi.login(payload));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
                throw err;
            } finally {
                setSigningIn(false);
            }
        },
        [persistSession],
    );

    const signUp = useCallback<AuthContextValue['signUp']>(
        async (payload) => {
            setSigningUp(true);
            setError(null);
            try {
                persistSession(await authApi.register(payload));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Đăng ký thất bại.');
                throw err;
            } finally {
                setSigningUp(false);
            }
        },
        [persistSession],
    );

    const signOut = useCallback<AuthContextValue['signOut']>(async () => {
        await authApi.logout();
        writePersistedAuth(null);
        setUser(null);
        setToken(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const value = useMemo<AuthContextValue>(
        () => ({ user, token, signingIn, signingUp, error, signIn, signUp, signOut, clearError }),
        [user, token, signingIn, signingUp, error, signIn, signUp, signOut, clearError],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}