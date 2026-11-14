import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import './UserMenu.css';

export function UserMenu() {
    const { user, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    if (!user) return null;

    const initials = (user.fullName || user.email)
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';

    return (
        <div className="user-menu" ref={ref}>
            <button
                type="button"
                className="user-menu__trigger"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Tài khoản"
            >
                {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" className="user-menu__avatar" />
                    : <span className="user-menu__avatar user-menu__avatar--fallback">{initials}</span>}
            </button>

            {open && (
                <div className="user-menu__popover" role="menu">
                    <div className="user-menu__info">
                        <strong>{user.fullName || 'Người dùng'}</strong>
                        <span>{user.email}</span>
                    </div>
                    <button
                        type="button"
                        className="user-menu__action"
                        role="menuitem"
                        onClick={() => { setOpen(false); void signOut(); }}
                    >
                        Đăng xuất
                    </button>
                </div>
            )}
        </div>
    );
}