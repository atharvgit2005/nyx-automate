'use client';

import { TrendingUp } from 'lucide-react';

export default function Trends() {
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-theme-primary flex items-center gap-3">
                    <TrendingUp className="h-7 w-7 text-purple-500" />
                    Trends
                </h1>
                <p className="mt-2 text-theme-secondary">
                    What&apos;s breaking out right now, turned into image and content directions.
                </p>
            </div>

            <div className="bg-card-theme border border-theme rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
                <p className="mt-5 text-theme-primary font-semibold">Trend analysis is being built</p>
                <p className="mt-1 text-sm text-theme-secondary max-w-md">
                    This will run on an n8n workflow that aggregates signals across platforms and
                    summarises them with Gemini. Coming in a later build step.
                </p>
            </div>
        </div>
    );
}
