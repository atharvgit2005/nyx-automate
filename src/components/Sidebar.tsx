'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSidebar } from '@/context/SidebarContext';
import Image from 'next/image';
import {
    LayoutDashboard,
    Sparkles,
    PenLine,
    BrainCircuit,
    TrendingUp,
    Target,
    Mic,
    Wand2,
    MoreHorizontal,
    LogOut
} from 'lucide-react';

export const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Image Studio', href: '/dashboard/studio', icon: Sparkles },
    { name: 'Copywriter', href: '/dashboard/copy', icon: PenLine },
    { name: 'Content Factory', href: '/dashboard/content', icon: Wand2 },
    { name: 'Leads', href: '/dashboard/leads', icon: Target },
    { name: 'Brand Analysis', href: '/dashboard/analysis', icon: BrainCircuit },
    { name: 'Trends', href: '/dashboard/trends', icon: TrendingUp },
    { name: 'Voice', href: '/dashboard/avatar', icon: Mic, soon: true },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { collapsed } = useSidebar();
    const { data: session } = useSession();

    const name = session?.user?.name || 'User';
    const avatar = session?.user?.image || null;
    const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div
            className={`hidden md:flex md:flex-col md:fixed md:left-0 md:bottom-0 md:top-16 header-bg-theme backdrop-blur-xl z-40 transition-all duration-300 border-r-2 border-theme ${collapsed ? 'md:w-20' : 'md:w-60'
                }`}
        >
            <div className={`flex-1 flex flex-col overflow-y-auto ${collapsed ? 'py-4' : 'py-6'}`}>

                {!collapsed && (
                    <div className="px-5 mb-3">
                        <span className="kicker text-theme-secondary">Workspace</span>
                    </div>
                )}

                <nav className={`flex-1 ${collapsed ? 'px-3 space-y-2' : 'px-3 space-y-0.5'}`}>
                    {navigation.map((item, i) => {
                        const isActive = item.href === '/dashboard'
                            ? pathname === item.href
                            : pathname.startsWith(item.href);
                        const Icon = item.icon;
                        const num = String(i + 1).padStart(2, '0');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                title={collapsed ? item.name : ''}
                                className={`group flex items-center gap-3 transition-all duration-150 relative ${collapsed
                                    ? 'w-12 h-12 justify-center mx-auto rounded-md'
                                    : 'px-3 py-2.5 rounded-md'
                                    } ${isActive
                                        ? 'bg-purple-600 text-white'
                                        : 'text-theme-secondary hover:bg-white/5 hover:text-theme-primary'
                                    }`}
                            >
                                {!collapsed && (
                                    <span className={`index-num text-[11px] w-4 text-center ${isActive ? 'text-white/70' : 'text-theme-secondary opacity-40 group-hover:opacity-70'}`}>{num}</span>
                                )}
                                <Icon className={`flex-shrink-0 ${collapsed ? 'h-5 w-5' : 'h-[17px] w-[17px]'} ${isActive ? 'text-white' : 'text-theme-secondary group-hover:text-purple-500'}`} />
                                {!collapsed && (
                                    <span className="truncate font-bold uppercase tracking-[0.06em] text-[12.5px]" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{item.name}</span>
                                )}
                                {!collapsed && item.soon && (
                                    <span className="ml-auto text-[9px] uppercase tracking-wider text-theme-secondary border border-theme rounded px-1.5 py-0.5">soon</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Sign out */}
            <div className="px-3 pb-3">
                <hr className="rule mb-3 opacity-60" />
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    title={collapsed ? 'Sign out' : ''}
                    className={`group flex items-center gap-3 w-full transition-all duration-150 text-theme-secondary hover:bg-white/5 hover:text-purple-500 ${collapsed
                        ? 'w-12 h-12 justify-center mx-auto rounded-md'
                        : 'px-3 py-2.5 rounded-md'
                        }`}
                >
                    <LogOut className={`${collapsed ? 'h-5 w-5' : 'h-[17px] w-[17px]'} flex-shrink-0`} />
                    {!collapsed && <span className="truncate font-bold uppercase tracking-[0.06em] text-[12.5px]" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Sign out</span>}
                </button>
            </div>

            {/* User tab */}
            <div className={`px-3 ${collapsed ? 'pb-4' : 'pb-6'}`}>
                <Link href="/dashboard/profile">
                    <div className={`flex items-center transition-all duration-150 cursor-pointer group ${collapsed
                        ? 'w-12 h-12 justify-center mx-auto rounded-md bg-secondary'
                        : 'p-2.5 panel hover:border-purple-500/40'
                        }`}>
                        <div className={`rounded-md bg-purple-600 border border-white/10 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden relative ${collapsed ? 'h-8 w-8' : 'h-9 w-9'}`}>
                            {avatar ? (
                                <Image src={avatar} alt={name} fill className="object-cover" sizes="40px" />
                            ) : (
                                <span className={collapsed ? 'text-[10px]' : 'text-sm'}>{initials}</span>
                            )}
                        </div>
                        {!collapsed && (
                            <>
                                <div className="ml-3 flex-1 overflow-hidden">
                                    <p className="text-sm font-bold text-theme-primary truncate group-hover:text-purple-500 transition-colors">{name}</p>
                                    <p className="text-[10px] text-theme-secondary truncate uppercase tracking-[0.15em]">NYX Admin</p>
                                </div>
                                <MoreHorizontal className="h-4 w-4 text-theme-secondary ml-2" />
                            </>
                        )}
                    </div>
                </Link>
            </div>
        </div>
    );
}
