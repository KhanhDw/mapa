import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
    AuthLayout,
    PasswordToggle,
} from './AuthLayout';

export interface LoginFormValues {
    email: string;
    password: string;
    rememberMe: boolean;
}

export interface LoginFormErrors {
    email?: string;
    password?: string;
}

interface LoginPageProps {
    onSubmit?: (values: LoginFormValues) => void | Promise<void>;
    onSwitchToRegister?: () => void;
    onForgotPassword?: () => void;
    onGoogleSignIn?: () => void;
    submitting?: boolean;
    serverError?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage({
    onSubmit,
    onSwitchToRegister,
    onForgotPassword,
    submitting = false,
    serverError = null,
}: LoginPageProps) {
    const [form, setForm] = useState<LoginFormValues>({ email: '', password: '', rememberMe: false });
    const [errors, setErrors] = useState<LoginFormErrors>({});
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const busy = submitting || isSubmitting;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const field = name as keyof LoginFormValues;
        setForm((prev) => ({
            ...prev,
            [field]: type === 'checkbox' ? checked : value,
        }));
        setErrors((prev) =>
            prev[field as keyof LoginFormErrors] ? { ...prev, [field]: undefined } : prev,
        );
    };

    const validate = (): boolean => {
        const next: LoginFormErrors = {};
        if (!form.email.trim()) next.email = 'Email address is required.';
        else if (!EMAIL_RE.test(form.email)) next.email = 'Please enter a valid email address.';
        if (!form.password) next.password = 'Password is required.';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            await onSubmit?.(form);
        } catch {
            /* AuthContext đã set serverError, không cần log lại */
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthLayout>
            <header className="form-header">
                <h1 className="form-title">Welcome back!</h1>
                <p className="form-subtitle">
                    Please enter your details to sign in to your workspace.
                </p>
            </header>

            {serverError && (
                <div className="form-error-banner" role="alert">{serverError}</div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div className="input-group">
                    <label htmlFor="email" className="input-label">Email address</label>
                    <div className="input-wrapper">
                        <input
                            id="email"
                            name="email"
                            type="email"
                            className={`auth-input ${errors.email ? 'input-error' : ''}`}
                            placeholder="you@company.com"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="email"
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'email-error' : undefined}
                        />
                    </div>
                    {errors.email && (
                        <span id="email-error" className="error-text" role="alert">
                            {errors.email}
                        </span>
                    )}
                </div>

                {/* Password */}
                <div className="input-group">
                    <div className="input-label-row">
                        <label htmlFor="password" className="input-label">Password</label>
                        <button
                            type="button"
                            className="forgot-link"
                            onClick={onForgotPassword}
                        >
                            Forgot password?
                        </button>
                    </div>
                    <div className="input-wrapper">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`auth-input has-icon ${errors.password ? 'input-error' : ''}`}
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                        />
                        <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                    </div>
                    {errors.password && (
                        <span id="password-error" className="error-text" role="alert">
                            {errors.password}
                        </span>
                    )}
                </div>

                {/* Remember me */}
                <div className="remember-row">
                    <input
                        id="remember"
                        name="rememberMe"
                        type="checkbox"
                        className="remember-checkbox"
                        checked={form.rememberMe}
                        onChange={handleChange}
                    />
                    <label htmlFor="remember" className="remember-label">Remember for 30 days</label>
                </div>

                {/* Actions */}
                <div className="button-group">
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {isSubmitting ? 'Signing in…' : 'Sign in'}
                    </button>
                </div>
            </form>

            <footer className="form-footer">
                Don&apos;t have an account?{' '}
                <button type="button" className="switch-link" onClick={onSwitchToRegister}>
                    Sign up
                </button>
            </footer>
        </AuthLayout>
    );
}

export default LoginPage;