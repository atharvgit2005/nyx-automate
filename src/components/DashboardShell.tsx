'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useSidebar } from '@/context/SidebarContext';

export default function DashboardShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const { collapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-page text-theme-primary transition-colors duration-300">
            <Header />
            <Sidebar />
            <div className={`flex flex-col flex-1 min-h-screen transition-all duration-300 pt-16 ${collapsed ? 'md:pl-20' : 'md:pl-60'}`}>
                <main className="flex-1 px-5 sm:px-6 py-5">
                    {children}
                </main>
            </div>
        </div>
    );
}
