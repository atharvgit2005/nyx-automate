'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSidebar } from '@/context/SidebarContext';
import Image from 'next/image';
import {
    LayoutDashboard,
    Sparkles,
    BrainCircuit,
    TrendingUp,
    Target,
    Mic,
    MoreHorizontal,
    LogOut
} from 'lucide-react';

export const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Image Studio', href: '/dashboard/studio', icon: Sparkles },
    { name: 'Leads', href: '/dashboard/leads', icon: Target },
    { name: 'Brand Analysis', href: '/dashboard/analysis', icon: BrainCircuit },
    { name: 'Trends', href: '/dashboard/trends', icon: TrendingUp },
    { name: 'Voice', href: '/dashboard/avatar', icon: Mic, soon: true },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { collapsed } = useSidebar();
    const { data: session } = useSession();

    // Derive initials from name
    const name = session?.user?.name || 'User';
    const avatar = session?.user?.image || null;
    const initials = name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div
            className={`hidden md:flex md:flex-col md:fixed md:left-0 md:bottom-0 md:top-20 header-bg-theme backdrop-blur-xl z-40 transition-all duration-300 border-r border-theme rounded-r-3xl ${collapsed ? 'md:w-20' : 'md:w-56'
                }`}
        >
            <div className={`flex-1 flex flex-col overflow-y-auto ${collapsed ? 'py-4' : 'py-8'}`}>

                <nav className={`flex-1 px-4 mt-4 ${collapsed ? 'space-y-3' : 'space-y-1.5'}`}>

                    {navigation.map((item) => {
                        const isActive = item.href === '/dashboard'
                            ? pathname === item.href
                            : pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                title={collapsed ? item.name : ''}
                                className={`group flex items-center transition-all duration-200 relative overflow-hidden ${collapsed
                                    ? 'w-12 h-12 justify-center mx-auto rounded-xl'
                                    : 'px-4 py-3 mx-1 rounded-xl'
                                    } ${isActive
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'text-theme-secondary hover:bg-white/5 hover:text-purple-500 border border-transparent hover:border-purple-500/20'
                                    }`}
                            >
                                <Icon className={`transition-all duration-200 ${collapsed ? 'h-5 w-5' : 'h-[18px] w-[18px] mr-3'} ${isActive ? 'text-white' : 'text-theme-secondary group-hover:text-purple-500'}`} />
                                {!collapsed && (
                                    <span className="truncate font-semibold tracking-wide text-sm">{item.name}</span>
                                )}
                                {!collapsed && item.soon && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wider text-theme-secondary bg-white/5 border border-theme rounded-full px-2 py-0.5">soon</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Sign out */}
            <div className={`px-4 pb-4 ${collapsed ? 'mt-auto' : ''}`}>
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    title={collapsed ? 'Sign out' : ''}
                    className={`group flex items-center w-full transition-all duration-200 text-theme-secondary hover:bg-white/5 hover:text-purple-500 border border-transparent hover:border-purple-500/20 ${collapsed
                        ? 'w-12 h-12 justify-center mx-auto rounded-xl'
                        : 'px-4 py-3 mx-1 rounded-xl font-semibold'
                        }`}
                >
                    <LogOut className={`transition-all duration-200 text-theme-secondary group-hover:text-purple-500 ${collapsed ? 'h-5 w-5' : 'h-[18px] w-[18px] mr-3'}`} />
                    {!collapsed && (
                        <span className="truncate text-sm">Sign out</span>
                    )}
                </button>
            </div>

            {/* User Tab */}
            <div className={`px-4 ${collapsed ? 'pb-4' : 'pb-8'}`}>
                <Link href="/dashboard/profile">
                    <div className={`flex items-center transition-all duration-200 cursor-pointer group relative ${collapsed
                        ? 'w-12 h-12 justify-center mx-auto rounded-xl bg-secondary'
                        : 'p-3 mx-1 bg-secondary rounded-2xl border border-theme hover:border-purple-500/30'
                        }`}>
                        {/* Avatar: image or initials */}
                        <div className={`rounded-full bg-purple-600 border border-white/10 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden relative group-hover:scale-105 transition-transform duration-200 ${collapsed ? 'h-8 w-8' : 'h-9 w-9'}`}>
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
                                    <p className="text-[10px] text-theme-secondary truncate uppercase tracking-wider opacity-70 group-hover:opacity-100 transition-opacity">NYX Admin</p>
                                </div>
                                <MoreHorizontal className="h-5 w-5 text-theme-secondary group-hover:text-theme-primary transition-colors ml-2" />
                            </>
                        )}
                    </div>
                </Link>
            </div>
        </div>
    );
}
