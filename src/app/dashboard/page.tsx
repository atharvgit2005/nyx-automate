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
        <div className="space-y-10">
            {/* Hero */}
            <div>
                <p className="text-sm text-theme-secondary uppercase tracking-widest">{greeting}</p>
                <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-theme-primary">
                    {firstName}, let&apos;s make something.
                </h1>
                <p className="mt-3 text-theme-secondary max-w-2xl">
                    Your NYX creative workspace — image generation first, with brand and trend
                    intelligence to point it in the right direction.
                </p>
                <Link
                    href="/dashboard/studio"
                    className="bg-purple-600 inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl text-white font-semibold"
                >
                    <Sparkles className="h-[18px] w-[18px]" />
                    Open Image Studio
                    <ArrowRight className="h-[18px] w-[18px]" />
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-card-theme border border-theme rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-theme-secondary">{s.label}</span>
                                <Icon className="h-5 w-5 text-purple-500" />
                            </div>
                            <p className="mt-3 text-3xl font-bold text-theme-primary">{s.value}</p>
                        </div>
                    );
                })}
            </div>

            {/* Tools */}
            <div>
                <h2 className="text-xl font-bold text-theme-primary mb-5">Workspace</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {tools.map((t) => {
                        const Icon = t.icon;
                        return (
                            <Link
                                key={t.name}
                                href={t.href}
                                className="group bg-card-theme border border-theme rounded-2xl p-6 hover:border-purple-500/30 hover:bg-card-hover transition-all flex flex-col"
                            >
                                <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <Icon className="h-5 w-5 text-purple-500" />
                                </div>
                                <h3 className="mt-4 text-lg font-bold text-theme-primary">{t.name}</h3>
                                <p className="mt-2 text-sm text-theme-secondary leading-relaxed flex-1">{t.desc}</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-500 group-hover:gap-2.5 transition-all">
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
                <h2 className="text-xl font-bold text-theme-primary mb-5">Recent activity</h2>
                <div className="bg-card-theme border border-theme rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                    <Clock className="h-8 w-8 text-theme-secondary opacity-50" />
                    <p className="mt-3 text-theme-secondary">No activity yet — your generations will show up here.</p>
                </div>
            </div>
        </div>
    );
}
