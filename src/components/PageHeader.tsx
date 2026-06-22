import type { ReactNode } from 'react';

/**
 * Compact app toolbar header: small kicker + modest title on the left,
 * actions on the right, thin divider. Tool-like, not a marketing hero.
 */
export default function PageHeader({
    kicker,
    title,
    subtitle,
    icon,
    right,
}: {
    kicker?: string;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    right?: ReactNode;
    /** Accepted for compatibility with existing call sites; not rendered in the compact header. */
    index?: string;
}) {
    return (
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-theme pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
                {icon}
                <div className="min-w-0">
                    {kicker && <span className="block text-[10px] uppercase tracking-[0.18em] text-theme-secondary leading-none mb-1">{kicker}</span>}
                    <div className="flex items-baseline gap-2">
                        <h1 className="font-display text-xl text-theme-primary leading-none">{title}</h1>
                        {subtitle && <span className="text-xs text-theme-secondary truncate hidden sm:inline">{subtitle}</span>}
                    </div>
                </div>
            </div>
            {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
        </div>
    );
}
