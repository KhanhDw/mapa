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
    submitting?: boolean;
    serverError?: string | null;
}

export function LoginPage({
    onSubmit,
    onSwitchToRegister,
    onForgotPassword,
    submitting = false,
    serverError = null,
}: LoginPageProps) {
    const [form, setForm] = useState<LoginFormValues>({
        email: '',
        password: '',
        rememberMe: false,
    });
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

        if (!form.email.trim()) {
            next.email = 'Vui lòng nhập tên đăng nhập hoặc email.';
        }

        if (!form.password) {
            next.password = 'Vui lòng nhập mật khẩu.';
        }

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
            /* Lỗi từ hệ thống được xử lý ở tầng AuthContext */
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthLayout>
            <header className="form-header">
                <h1 className="form-title">Đăng nhập</h1>
                <p className="form-subtitle">
                    Nhập thông tin tài khoản nội bộ để truy cập hệ thống.
                </p>
            </header>

            {serverError && (
                <div className="form-error-banner" role="alert">{serverError}</div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Tên đăng nhập hoặc Email */}
                <div className="input-group">
                    <label htmlFor="email" className="input-label">
                        Tên đăng nhập hoặc email
                    </label>

                    <div className="input-wrapper">
                        <input
                            id="email"
                            name="email"
                            type="text"
                            className={`auth-input ${errors.email ? 'input-error' : ''}`}
                            placeholder="nhap.ten.dang.nhap hoặc email@noibo.vn"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="username"
                            disabled={busy}
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

                {/* Mật khẩu */}
                <div className="input-group">
                    <div className="input-label-row">
                        <label htmlFor="password" className="input-label">Mật khẩu</label>
                        {onForgotPassword && (
                            <button
                                type="button"
                                className="forgot-link"
                                onClick={onForgotPassword}
                                disabled={busy}
                            >
                                Quên mật khẩu?
                            </button>
                        )}
                    </div>
                    <div className="input-wrapper">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`auth-input has-icon ${errors.password ? 'input-error' : ''}`}
                            placeholder="Nhập mật khẩu"
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                            disabled={busy}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                        />
                        <PasswordToggle
                            visible={showPassword}
                            onToggle={() => setShowPassword((v) => !v)}
                            fieldLabel="mật khẩu"
                        />
                    </div>
                    {errors.password && (
                        <span id="password-error" className="error-text" role="alert">
                            {errors.password}
                        </span>
                    )}
                </div>

                {/* Ghi nhớ đăng nhập */}
                <div className="remember-row">
                    <input
                        id="remember"
                        name="rememberMe"
                        type="checkbox"
                        className="remember-checkbox"
                        checked={form.rememberMe}
                        onChange={handleChange}
                        disabled={busy}
                    />
                    <label htmlFor="remember" className="remember-label">
                        Duy trì đăng nhập trong 30 ngày
                    </label>
                </div>

                {/* Nút gửi */}
                <div className="button-group">
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
                    </button>
                </div>
            </form>

            {onSwitchToRegister && (
                <footer className="form-footer">
                    Chưa có tài khoản nội bộ?{' '}
                    <button type="button" className="switch-link" onClick={onSwitchToRegister}>
                        Đăng ký tài khoản
                    </button>
                </footer>
            )}
        </AuthLayout>
    );
}

export default LoginPage;