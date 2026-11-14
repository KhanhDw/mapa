import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
    AuthLayout,
    PasswordToggle,
} from './AuthLayout';

export interface RegisterFormValues {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/* Điểm mạnh mật khẩu: 0 → 4 */
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

export function RegisterPage({ onSwitchToLogin, onRegisterSuccess,
    submitting = false,
    serverError = null,
}: RegisterPageProps) {
    const [form, setForm] = useState<RegisterFormValues>({
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

        if (!form.fullName.trim()) next.fullName = 'Full name is required.';
        else if (form.fullName.trim().length < 2) next.fullName = 'Name must be at least 2 characters.';

        if (!form.email.trim()) next.email = 'Email address is required.';
        else if (!EMAIL_RE.test(form.email)) next.email = 'Please enter a valid email address.';

        if (!form.password) next.password = 'Password is required.';
        else if (form.password.length < MIN_PASSWORD_LENGTH)
            next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

        if (form.confirmPassword !== form.password)
            next.confirmPassword = 'Passwords do not match.';

        if (!form.agreeTerms)
            next.agreeTerms = 'You must accept the terms to continue.';

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            // XOÁ dòng setTimeout giả lập
            await onRegisterSuccess?.({
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                password: form.password,
                agreeTerms: form.agreeTerms,
            });
        } catch {
            /* AuthContext đã set serverError */
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <AuthLayout>
            <header className="form-header">
                <h1 className="form-title">Create an account</h1>
                <p className="form-subtitle">
                    Start your 14-day free trial. No credit card required.
                </p>
            </header>
            {serverError && (
                <div className="form-error-banner" role="alert">{serverError}</div>
            )}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Full name */}
                <div className="input-group">
                    <label htmlFor="fullName" className="input-label">Full name</label>
                    <div className="input-wrapper">
                        <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            className={`auth-input ${errors.fullName ? 'input-error' : ''}`}
                            placeholder="Alex Rivera"
                            value={form.fullName}
                            onChange={handleChange}
                            autoComplete="name"
                            aria-invalid={Boolean(errors.fullName)}
                            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                        />
                    </div>
                    {errors.fullName && (
                        <span id="fullName-error" className="error-text" role="alert">{errors.fullName}</span>
                    )}
                </div>

                {/* Email */}
                <div className="input-group">
                    <label htmlFor="reg-email" className="input-label">Work email</label>
                    <div className="input-wrapper">
                        <input
                            id="reg-email"
                            name="email"
                            type="email"
                            className={`auth-input ${errors.email ? 'input-error' : ''}`}
                            placeholder="you@company.com"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="email"
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'reg-email-error' : undefined}
                        />
                    </div>
                    {errors.email && (
                        <span id="reg-email-error" className="error-text" role="alert">{errors.email}</span>
                    )}
                </div>

                {/* Password */}
                <div className="input-group">
                    <label htmlFor="reg-password" className="input-label">Password</label>
                    <div className="input-wrapper">
                        <input
                            id="reg-password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className={`auth-input has-icon ${errors.password ? 'input-error' : ''}`}
                            placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'reg-password-error' : undefined}
                        />
                        <PasswordToggle
                            visible={showPassword}
                            onToggle={() => setShowPassword((v) => !v)}
                        />
                    </div>

                    {form.password.length > 0 && (
                        <div className="strength-meter" aria-hidden="true">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className={`strength-bar ${strengthClassFor(passwordStrength, i)}`} />
                            ))}
                        </div>
                    )}
                    {errors.password && (
                        <span id="reg-password-error" className="error-text" role="alert">{errors.password}</span>
                    )}
                </div>

                {/* Confirm password */}
                <div className="input-group">
                    <label htmlFor="confirmPassword" className="input-label">Confirm password</label>
                    <div className="input-wrapper">
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            className={`auth-input has-icon ${errors.confirmPassword ? 'input-error' : ''}`}
                            placeholder="Re-enter password"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            autoComplete="new-password"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                        />
                        <PasswordToggle
                            visible={showConfirmPassword}
                            onToggle={() => setShowConfirmPassword((v) => !v)}
                            fieldLabel="confirm password"
                        />
                    </div>
                    {errors.confirmPassword && (
                        <span id="confirmPassword-error" className="error-text" role="alert">
                            {errors.confirmPassword}
                        </span>
                    )}
                </div>

                {/* Terms */}
                <div className="input-group">
                    <div className="checkbox-row">
                        <input
                            id="agreeTerms"
                            name="agreeTerms"
                            type="checkbox"
                            className="auth-checkbox"
                            checked={form.agreeTerms}
                            onChange={handleChange}
                            aria-invalid={Boolean(errors.agreeTerms)}
                        />
                        <label htmlFor="agreeTerms" className="checkbox-label">
                            I agree to the{' '}
                            <a href="#terms" className="inline-link">Terms of Service</a>{' '}
                            and{' '}
                            <a href="#privacy" className="inline-link">Privacy Policy</a>.
                        </label>
                    </div>
                    {errors.agreeTerms && (
                        <span className="error-text" role="alert">{errors.agreeTerms}</span>
                    )}
                </div>

                {/* Actions */}
                <div className="button-group">
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {isSubmitting ? 'Creating account…' : 'Create account'}
                    </button>

                </div>
            </form>

            <footer className="form-footer">
                Already have an account?{' '}
                <button type="button" className="switch-link" onClick={onSwitchToLogin}>
                    Sign in
                </button>
            </footer>
        </AuthLayout>
    );
}

export default RegisterPage;