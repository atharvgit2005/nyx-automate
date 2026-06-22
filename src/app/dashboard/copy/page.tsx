'use client';

import { useState } from 'react';
import { PenLine, Loader2, Copy, Check, Sparkles } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'X', 'Ad'];
const TONES = ['Bold', 'Friendly', 'Luxury', 'Playful', 'Professional'];
const TYPES = ['Caption', 'Ad copy', 'Hook', 'Hashtags'];

function Chips({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((it) => (
                <button key={it} onClick={() => onChange(it)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${value === it ? 'bg-purple-600 text-white border-transparent' : 'bg-secondary border-theme text-theme-secondary hover:text-purple-500'}`}>
                    {it}
                </button>
            ))}
        </div>
    );
}

export default function Copywriter() {
    const [topic, setTopic] = useState('');
    const [platform, setPlatform] = useState('Instagram');
    const [tone, setTone] = useState('Bold');
    const [type, setType] = useState('Caption');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [options, setOptions] = useState<string[]>([]);
    const [copied, setCopied] = useState<number | null>(null);

    const generate = async () => {
        if (!topic.trim()) { setError('Tell me what to promote.'); return; }
        setError(null); setBusy(true);
        try {
            const res = await fetch('/api/copy/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, platform, tone, type }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed.');
            setOptions(data.options ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Generation failed.');
        } finally {
            setBusy(false);
        }
    };

    const copy = (text: string, i: number) => { navigator.clipboard?.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1200); };

    return (
        <div>
            <PageHeader
                index="02"
                kicker="Write"
                title="Copywriter"
                subtitle="Captions, ad copy, hooks and hashtags — written by AI, ready to post."
                icon={<PenLine className="h-8 w-8 text-purple-500" />}
            />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Controls */}
                <div className="lg:col-span-2 space-y-5">
                    <div className="bg-card-theme border border-theme rounded-2xl p-5 space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-theme-primary">What are you promoting?</label>
                            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} placeholder="e.g. a new oat-milk latte at our Mumbai cafe, launch this weekend"
                                className="mt-2 w-full bg-secondary border border-theme rounded-xl p-3 text-theme-primary placeholder-gray-500 resize-y focus:border-purple-500/50 focus:outline-none text-sm leading-relaxed" />
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-wider text-theme-secondary">Platform</label>
                            <div className="mt-2"><Chips items={PLATFORMS} value={platform} onChange={setPlatform} /></div>
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-wider text-theme-secondary">Tone</label>
                            <div className="mt-2"><Chips items={TONES} value={tone} onChange={setTone} /></div>
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-wider text-theme-secondary">Type</label>
                            <div className="mt-2"><Chips items={TYPES} value={type} onChange={setType} /></div>
                        </div>
                        <button onClick={generate} disabled={busy}
                            className="bg-purple-600 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-bold disabled:opacity-50">
                            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                            {busy ? 'Writing…' : 'Generate'}
                        </button>
                    </div>
                </div>

                {/* Results */}
                <div className="lg:col-span-3 space-y-3">
                    {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                    {options.length === 0 && !error && (
                        <div className="bg-card-theme border border-theme rounded-2xl min-h-[300px] flex flex-col items-center justify-center text-center p-10">
                            <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                <PenLine className="h-8 w-8 text-purple-500" />
                            </div>
                            <p className="mt-5 text-theme-primary font-semibold">Your copy will appear here</p>
                            <p className="mt-1 text-sm text-theme-secondary max-w-sm">Describe what you&apos;re promoting, pick a platform and tone, then generate.</p>
                        </div>
                    )}
                    {options.map((opt, i) => (
                        <div key={i} className="bg-card-theme border border-theme rounded-2xl p-4 flex items-start gap-3 group hover:border-purple-500/30 transition-colors">
                            <p className="flex-1 text-sm text-theme-primary whitespace-pre-wrap leading-relaxed">{opt}</p>
                            <button onClick={() => copy(opt, i)} title="Copy" className="text-theme-secondary hover:text-purple-500 flex-shrink-0">
                                {copied === i ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
