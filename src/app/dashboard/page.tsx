'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Sparkles, BrainCircuit, TrendingUp, ArrowRight, ImageIcon, Wand2, Clock } from 'lucide-react';

const tools = [
    {
        name: 'Image Studio',
        href: '/dashboard/studio',
        icon: Sparkles,
        desc: 'Generate images across GPT-Image, Gemini and Flux with prompt templates and a refiner.',
        cta: 'Open studio',
    },
    {
        name: 'Brand Analysis',
        href: '/dashboard/analysis',
        icon: BrainCircuit,
        desc: 'Pull a brand or creator profile and break down niche, tone, audience and content pillars.',
        cta: 'Analyse a brand',
    },
    {
        name: 'Trends',
        href: '/dashboard/trends',
        icon: TrendingUp,
        desc: 'Track what is breaking out right now and turn it into image and content directions.',
        cta: 'See trends',
    },
];

const stats = [
    { label: 'Images generated', value: '—', icon: ImageIcon },
    { label: 'Prompts refined', value: '—', icon: Wand2 },
    { label: 'Brand reports', value: '—', icon: BrainCircuit },
];

export default function Dashboard() {
    const { data: session } = useSession();
    const firstName = (session?.user?.name || 'there').split(' ')[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return (
        <div className="space-y-6">
            {/* Compact control bar */}
            <div className="flex items-center justify-between gap-4 border-b border-theme pb-3">
                <div>
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-theme-secondary leading-none mb-1">{greeting}</span>
                    <h1 className="font-display text-xl text-theme-primary leading-none">{firstName}</h1>
                </div>
                <Link
                    href="/dashboard/studio"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-purple-600 text-white font-bold text-sm"
                >
                    <Sparkles className="h-4 w-4" />
                    New image
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="panel p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-[0.15em] text-theme-secondary">{s.label}</span>
                                <Icon className="h-4 w-4 text-purple-500" />
                            </div>
                            <p className="mt-2 font-display text-3xl text-theme-primary">{s.value}</p>
                        </div>
                    );
                })}
            </div>

            {/* Tools */}
            <div>
                <div className="flex items-center gap-3 mb-5">
                    <span className="kicker text-theme-secondary">Workspace</span>
                    <hr className="rule flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {tools.map((t, i) => {
                        const Icon = t.icon;
                        return (
                            <Link
                                key={t.name}
                                href={t.href}
                                className="group panel p-6 hover:border-purple-500/40 transition-all flex flex-col relative"
                            >
                                <span className="index-num absolute top-4 right-5 text-3xl text-theme-secondary opacity-15 leading-none">{String(i + 1).padStart(2, '0')}</span>
                                <div className="h-11 w-11 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <Icon className="h-5 w-5 text-purple-500" />
                                </div>
                                <h3 className="mt-4 font-display text-2xl text-theme-primary">{t.name}</h3>
                                <p className="mt-2 text-sm text-theme-secondary leading-relaxed flex-1">{t.desc}</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-purple-500 group-hover:gap-2.5 transition-all">
                                    {t.cta}
                                    <ArrowRight className="h-4 w-4" />
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Recent activity */}
            <div>
                <div className="flex items-center gap-3 mb-5">
                    <span className="kicker text-theme-secondary">Recent activity</span>
                    <hr className="rule flex-1" />
                </div>
                <div className="panel p-10 flex flex-col items-center justify-center text-center">
                    <Clock className="h-8 w-8 text-theme-secondary opacity-50" />
                    <p className="mt-3 text-theme-secondary">No activity yet — your generations will show up here.</p>
                </div>
            </div>
        </div>
    );
}
