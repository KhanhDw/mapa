
import { useEffect, useRef, useState } from "react";
import { Settings, LogOut } from "lucide-react";
import { useAuth } from "../useAuth";
import "./UserMenu.css";

interface Props {
    onSettingsClick: () => void;
}

export function UserMenu({ onSettingsClick }: Props) {
    const { user, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const onDown = (event: MouseEvent) => {
            if (
                ref.current &&
                !ref.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onDown);

        return () => {
            document.removeEventListener("mousedown", onDown);
        };
    }, [open]);

    if (!user) return null;

    const initials = (user.fullName || user.email)
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "?";

    const handleSettingsClick = () => {
        setOpen(false);
        onSettingsClick();
    };

    const handleSignOut = () => {
        setOpen(false);
        void signOut();
    };

    return (
        <div className="user-menu" ref={ref}>
            <button
                type="button"
                className="user-menu__trigger"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Tài khoản"
                title="Tài khoản"
            >
                {user.avatarUrl ? (
                    <img
                        src={user.avatarUrl}
                        alt=""
                        className="user-menu__avatar"
                    />
                ) : (
                    <span className="user-menu__avatar user-menu__avatar--fallback">
                        {initials}
                    </span>
                )}
            </button>

            {open && (
                <div className="user-menu__popover" role="menu">
                    <div className="user-menu__info">
                        <strong>{user.fullName || "Người dùng"}</strong>
                        <span>{user.email}</span>
                    </div>

                    <button
                        type="button"
                        className="user-menu__item"
                        role="menuitem"
                        onClick={handleSettingsClick}
                    >
                        <Settings size={17} />
                        <span>Cài đặt</span>
                    </button>

                    <button
                        type="button"
                        className="user-menu__item user-menu__item--danger"
                        role="menuitem"
                        onClick={handleSignOut}
                    >
                        <LogOut size={17} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            )}
        </div>
    );
}
