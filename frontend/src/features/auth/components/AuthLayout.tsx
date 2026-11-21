import type { ReactNode } from 'react';
import './AuthLayout.css';

interface AuthLayoutProps {
    children: ReactNode;
    appName?: string;
}

/* -------------------------------------------------------------------------- */
/* Biểu tượng dùng chung                                                      */
/* -------------------------------------------------------------------------- */

const BrandMark = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="4" fill="#FFFFFF" />
        <rect x="14" y="4" width="6" height="16" rx="3" fill="#FFD93D" />
        <circle cx="8" cy="17" r="3" fill="#FF8C42" />
    </svg>
);

export const EyeOpen = () => (
    <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export const EyeClosed = () => (
    <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

interface PasswordToggleProps {
    visible: boolean;
    onToggle: () => void;
    /** Nhãn trường mật khẩu bằng tiếng Việt, ví dụ: "mật khẩu", "xác nhận mật khẩu" */
    fieldLabel?: string;
}

export const PasswordToggle = ({
    visible,
    onToggle,
    fieldLabel = 'mật khẩu',
}: PasswordToggleProps) => (
    <button
        type="button"
        className="password-toggle"
        onClick={onToggle}
        aria-label={visible ? `Ẩn ${fieldLabel}` : `Hiện ${fieldLabel}`}
        aria-pressed={visible}
    >
        {visible ? <EyeClosed /> : <EyeOpen />}
    </button>
);

/* -------------------------------------------------------------------------- */
/* Thành phần trang trí                                                       */
/* -------------------------------------------------------------------------- */

const KawaiiFace = () => (
    <div className="kawaii-face" aria-hidden="true">
        <div className="eyes-row">
            {[0, 1].map((i) => (
                <div className="eye" key={i}>
                    <div className="pupil">
                        <div className="reflection" />
                    </div>
                </div>
            ))}
        </div>
        <div className="smile" />
    </div>
);

const CHARACTER_VARIANTS = [
    'char-purple',
    'char-charcoal',
    'char-yellow',
    'char-orange',
] as const;

/* -------------------------------------------------------------------------- */
/* Khung bố cục xác thực                                                       */
/* -------------------------------------------------------------------------- */

export const AuthLayout = ({ children, appName = 'Hệ thống nội bộ' }: AuthLayoutProps) => (
    <div className="auth-wrapper">
        <section className="illustration-side" aria-label="Minh họa hệ thống nội bộ">
            <a href="#home" className="brand-logo">
                <span className="brand-icon"><BrandMark /></span>
                <span className="brand-name">{appName}</span>
                <span className="brand-badge">Nội bộ</span>
            </a>

            {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`sparkle sparkle-${n}`} aria-hidden="true" />
            ))}

            <div className="characters-stage" aria-hidden="true">
                {CHARACTER_VARIANTS.map((variant) => (
                    <div key={variant} className={`geo-character ${variant}`}>
                        <KawaiiFace />
                    </div>
                ))}
            </div>

            <p className="illustration-caption">
                Cổng làm việc và quản lý nghiệp vụ nội bộ
            </p>
        </section>

        <main className="form-side">
            <div className="form-container">{children}</div>
        </main>
    </div>
);