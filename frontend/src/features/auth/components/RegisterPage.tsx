import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
    AuthLayout,
    PasswordToggle,
} from './AuthLayout';

export interface RegisterFormValues {
    username: string;
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    agreeTerms: boolean;
}

export type RegisterPayload = Omit<RegisterFormValues, 'confirmPassword'>;

type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

interface RegisterPageProps {
    onSwitchToLogin: () => void;
    onRegisterSuccess?: (data: RegisterPayload) => void | Promise<void>;
    submitting?: boolean;
    serverError?: string | null;
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/* Điểm mạnh mật khẩu: 0 -> 4 */
const scorePassword = (pwd: string): number => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= MIN_PASSWORD_LENGTH) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
};

const strengthClassFor = (score: number, index: number): string => {
    if (score <= index) return '';
    return ['active-weak', 'active-fair', 'active-good', 'active-strong'][score - 1];
};

const strengthLabelFor = (score: number): string => {
    const labels = [
        'Mật khẩu yếu — nên có ít nhất 8 ký tự, chữ hoa, số và ký tự đặc biệt',
        'Độ mạnh: Yếu',
        'Độ mạnh: Trung bình',
        'Độ mạnh: Khá',
        'Độ mạnh: Mạnh',
    ];
    return labels[score] ?? labels[0];
};

export function RegisterPage({
    onSwitchToLogin,
    onRegisterSuccess,
    submitting = false,
    serverError = null,
}: RegisterPageProps) {
    const [form, setForm] = useState<RegisterFormValues>({
        username: '',
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        agreeTerms: false,
    });
    const [errors, setErrors] = useState<RegisterFormErrors>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordStrength = useMemo(() => scorePassword(form.password), [form.password]);
    const busy = submitting || isSubmitting;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const field = name as keyof RegisterFormValues;
        setForm((prev) => ({
            ...prev,
            [field]: type === 'checkbox' ? checked : value,
        }));
        setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };

    const validate = (): boolean => {
        const next: RegisterFormErrors = {};

        const trimmedUsername = form.username.trim();
        if (!trimmedUsername) {
            next.username = 'Vui lòng nhập tên đăng nhập.';
        } else if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
            next.username = 'Tên đăng nhập phải từ 3 đến 50 ký tự.';
        } else if (!USERNAME_RE.test(trimmedUsername)) {
            next.username = 'Tên đăng nhập chỉ được gồm chữ cái, số, dấu chấm, gạch dưới và gạch ngang.';
        }

        const trimmedFullName = form.fullName.trim();
        if (!trimmedFullName) {
            next.fullName = 'Vui lòng nhập họ và tên.';
        } else if (trimmedFullName.length < 2) {
            next.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
        }

        if (!form.email.trim()) {
            next.email = 'Vui lòng nhập email nội bộ.';
        } else if (!EMAIL_RE.test(form.email.trim())) {
            next.email = 'Địa chỉ email không hợp lệ.';
        }

        if (!form.password) {
            next.password = 'Vui lòng nhập mật khẩu.';
        } else if (form.password.length < MIN_PASSWORD_LENGTH) {
            next.password = `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
        }

        if (!form.confirmPassword) {
            next.confirmPassword = 'Vui lòng xác nhận lại mật khẩu.';
        } else if (form.confirmPassword !== form.password) {
            next.confirmPassword = 'Mật khẩu xác nhận không khớp.';
        }

        if (!form.agreeTerms) {
            next.agreeTerms = 'Bạn cần đồng ý với quy định sử dụng nội bộ để tiếp tục.';
        }

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            await onRegisterSuccess?.({
                username: form.username.trim(),
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                password: form.password,
                agreeTerms: form.agreeTerms,
            });
        } catch {
            /* Lỗi từ hệ thống được xử lý ở tầng AuthContext */
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthLayout>
            <header className="form-header">
                <h1 className="form-title">Đăng ký tài khoản</h1>
                <p className="form-subtitle">
                    Khởi tạo tài khoản để sử dụng hệ thống nội bộ.
                </p>
            </header>

            {serverError && (
                <div className="form-error-banner" role="alert">{serverError}</div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Tên đăng nhập */}
                <div className="input-group">
                    <label htmlFor="reg-username" className="input-label">
                        Tên đăng nhập
                    </label>
                    <div className="input-wrapper">
                        <input
                            id="reg-username"
                            name="username"
                            type="text"
                            className={`auth-input ${errors.username ? 'input-error' : ''}`}
                            placeholder="khanh.nguyen"
                            value={form.username}
                            onChange={handleChange}
                            autoComplete="username"
                            minLength={3}
                            maxLength={50}
                            disabled={busy}
                            aria-invalid={Boolean(errors.username)}
                            aria-describedby={errors.username ? 'reg-username-error' : undefined}
                        />
                    </div>
                    {errors.username && (
                        <span
                            id="reg-username-error"
                            className="error-text"
                            role="alert"
                        >
                            {errors.username}
                        </span>
                    )}
                </div>

                {/* Họ và tên */}
                <div className="input-group">
                    <label htmlFor="fullName" className="input-label">Họ và tên</label>
                    <div className="input-wrapper">
                        <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            className={`auth-input ${errors.fullName ? 'input-error' : ''}`}
                            placeholder="Nguyễn Văn A"
                            value={form.fullName}
                            onChange={handleChange}
                            autoComplete="name"
                            disabled={busy}
                            aria-invalid={Boolean(errors.fullName)}
                            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                        />
                    </div>
                    {errors.fullName && (
                        <span id="fullName-error" className="error-text" role="alert">
                            {errors.fullName}
                        </span>
                    )}
                </div>

                {/* Email nội bộ */}
                <div className="input-group">
                    <label htmlFor="reg-email" className="input-label">Email nội bộ</label>
                    <div className="input-wrapper">
                        <input
                            id="reg-email"
                            name="email"
                            type="email"
                            className={`auth-input ${errors.email ? 'input-error' : ''}`}
                            placeholder="ten@noibo.vn"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="email"
                            disabled={busy}
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'reg-email-error' : undefined}
                        />
                    </div>
                    {errors.email && (
                        <span id="reg-email-error" className="error-text" role="alert">
                            {errors.email}
                        </span>
                    )}
                </div>

                {/* Mật khẩu */}
                <div className="input-group">
                    <label htmlFor="reg-password" className="input-label">Mật khẩu</label>
                    <div className="input-wrapper">
                        <input
                            id="reg-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`auth-input has-icon ${errors.password ? 'input-error' : ''}`}
                            placeholder={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="new-password"
                            disabled={busy}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'reg-password-error' : undefined}
                        />
                        <PasswordToggle
                            visible={showPassword}
                            onToggle={() => setShowPassword((v) => !v)}
                            fieldLabel="mật khẩu"
                        />
                    </div>

                    {form.password.length > 0 && (
                        <div className="strength-wrapper" aria-hidden="true">
                            <div className="strength-meter">
                                {[0, 1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={`strength-bar ${strengthClassFor(passwordStrength, i)}`}
                                    />
                                ))}
                            </div>
                            <span className="strength-caption">
                                {strengthLabelFor(passwordStrength)}
                            </span>
                        </div>
                    )}
                    {errors.password && (
                        <span id="reg-password-error" className="error-text" role="alert">
                            {errors.password}
                        </span>
                    )}
                </div>

                {/* Xác nhận mật khẩu */}
                <div className="input-group">
                    <label htmlFor="confirmPassword" className="input-label">
                        Xác nhận mật khẩu
                    </label>
                    <div className="input-wrapper">
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            className={`auth-input has-icon ${errors.confirmPassword ? 'input-error' : ''}`}
                            placeholder="Nhập lại mật khẩu"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            autoComplete="new-password"
                            disabled={busy}
                            aria-invalid={Boolean(errors.confirmPassword)}
                            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                        />
                        <PasswordToggle
                            visible={showConfirmPassword}
                            onToggle={() => setShowConfirmPassword((v) => !v)}
                            fieldLabel="xác nhận mật khẩu"
                        />
                    </div>
                    {errors.confirmPassword && (
                        <span id="confirmPassword-error" className="error-text" role="alert">
                            {errors.confirmPassword}
                        </span>
                    )}
                </div>

                {/* Quy định sử dụng nội bộ */}
                <div className="input-group">
                    <div className="checkbox-row">
                        <input
                            id="agreeTerms"
                            name="agreeTerms"
                            type="checkbox"
                            className="auth-checkbox"
                            checked={form.agreeTerms}
                            onChange={handleChange}
                            disabled={busy}
                            aria-invalid={Boolean(errors.agreeTerms)}
                            aria-describedby={errors.agreeTerms ? 'agreeTerms-error' : undefined}
                        />
                        <label htmlFor="agreeTerms" className="checkbox-label">
                            Tôi đồng ý với{' '}
                            <a href="#internal-rules" className="inline-link">Nội quy sử dụng</a>{' '}
                            và{' '}
                            <a href="#data-policy" className="inline-link">Chính sách bảo mật dữ liệu</a>{' '}
                            nội bộ.
                        </label>
                    </div>
                    {errors.agreeTerms && (
                        <span id="agreeTerms-error" className="error-text" role="alert">
                            {errors.agreeTerms}
                        </span>
                    )}
                </div>

                {/* Nút gửi */}
                <div className="button-group">
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {isSubmitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
                    </button>
                </div>
            </form>

            <footer className="form-footer">
                Đã có tài khoản?{' '}
                <button type="button" className="switch-link" onClick={onSwitchToLogin}>
                    Đăng nhập
                </button>
            </footer>
        </AuthLayout>
    );
}

export default RegisterPage;