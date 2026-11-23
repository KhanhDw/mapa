
import { type ReactNode } from "react";

export function Section({
    icon,
    title,
    groupLabel,
    badge,
    children,
}: {
    icon: ReactNode;
    title: string;
    groupLabel?: string;
    badge?: string | number;
    children: ReactNode;
}) {
    return (
        <section className="cs-section">
            <header className="cs-section__header">
                <div className="cs-section__title-wrap">
                    {groupLabel && (
                        <span className="cs-section__group">{groupLabel}</span>
                    )}
                    <div className="cs-section__title">
                        <span className="cs-section__icon">{icon}</span>
                        <span>{title}</span>
                    </div>
                </div>
                {badge !== undefined && (
                    <span className="cs-badge">{badge}</span>
                )}
            </header>
            <div className="cs-section__body">{children}</div>
        </section>
    );
}

export function Skeleton({ lines = 2 }: { lines?: number }) {
    return (
        <div className="cs-skeleton" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
                <span
                    key={i}
                    className="cs-skeleton__line"
                    style={{ width: i === lines - 1 ? "60%" : "100%" }}
                />
            ))}
        </div>
    );
}