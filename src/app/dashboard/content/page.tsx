'use client';

import { useState, type ReactNode } from 'react';
import { Wand2, Loader2, Copy, Download, Sparkles } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

interface Piece {
    caption: string; hooks: string[]; hashtags: string[]; visualConcept: string; imagePrompt: string; provider?: string;
}
interface Result { piece: Piece; patterns: string[]; image: string | null; aspect: string }
interface ReelScript { hook: string; scenes: string[]; cta: string }
interface Pack { caption: string; carousel: string[]; reel: ReelScript; story: string; tweet: string; hashtags: string[]; provider?: string }

const ASPECTS = ['4:5', '1:1', '9:16', '16:9'];

export default function ContentFactory() {
    const [topic, setTopic] = useState('');
    const [brand, setBrand] = useState('');
    const [handles, setHandles] = useState('');
    const [aspect, setAspect] = useState('4:5');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<Result | null>(null);
    const [copied, setCopied] = useState('');
    const [mode, setMode] = useState<'create' | 'repurpose'>('create');
    const [source, setSource] = useState('');
    const [pack, setPack] = useState<Pack | null>(null);

    async function runRepurpose() {
        if (!source.trim()) { setError('Paste a topic or an existing post to repurpose.'); return; }
        setLoading(true); setError(''); setPack(null);
        try {
            const res = await fetch('/api/content/repurpose', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source, brand: brand || undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Repurpose failed');
            setPack(data.pack);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Repurpose failed');
        } finally {
            setLoading(false);
        }
    }

    async function generate() {
        if (!topic.trim()) { setError('Enter a topic or idea.'); return; }
        setLoading(true); setError(''); setResult(null);
        try {
            const res = await fetch('/api/content/factory', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, brand: brand || undefined, handles, aspect }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');
            setResult(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Generation failed');
        } finally {
            setLoading(false);
        }
    }

    const copy = (key: string, text: string) => {
        navigator.clipboard?.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500);
    };

    const p = result?.piece;
    const fullCaption = p ? `${p.caption}\n\n${p.hashtags.map((h) => `#${h}`).join(' ')}` : '';

    return (
        <div>
            <PageHeader
                kicker="Create"
                title="Content Factory"
                subtitle="A topic in — a ready-to-post caption + visual out. Free."
                icon={<Wand2 className="h-7 w-7 text-purple-500" />}
            />

            <div className="flex gap-2 mb-4">
                {([['create', 'Create new'], ['repurpose', 'Repurpose one idea']] as const).map(([m, label]) => (
                    <button key={m} onClick={() => { setMode(m); setError(''); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${mode === m ? 'bg-purple-600 text-white border-transparent' : 'bg-secondary border-theme text-theme-secondary hover:text-theme-primary'}`}>
                        {label}
                    </button>
                ))}
                <span className="self-center text-[11px] text-theme-secondary ml-1">
                    {mode === 'create' ? 'topic → caption + visual' : 'one idea → caption, carousel, reel, story, tweet'}
                </span>
            </div>

            {mode === 'create' && (
            <div className="bg-card-theme border border-theme rounded-2xl p-5 space-y-3 mb-6">
                <input
                    value={topic} onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && generate()}
                    placeholder="What's the post about? e.g. new cold brew launch"
                    className="w-full bg-secondary border border-theme rounded-lg px-3 py-2.5 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand voice (optional) — e.g. playful, premium" className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                    <input value={handles} onChange={(e) => setHandles(e.target.value)} placeholder="Inspired by @handles (optional)" className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        {ASPECTS.map((a) => (
                            <button key={a} onClick={() => setAspect(a)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${aspect === a ? 'bg-purple-600 text-white border-transparent' : 'bg-secondary border-theme text-theme-secondary'}`}>{a}</button>
                        ))}
                    </div>
                    <button onClick={generate} disabled={loading} className="ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-50">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {loading ? 'Creating…' : 'Generate post'}
                    </button>
                </div>
                {handles.trim() && <p className="text-[11px] text-theme-secondary">Inspiration on — it’ll mine those accounts’ winning patterns first (slower).</p>}
            </div>
            )}

            {mode === 'repurpose' && (
            <div className="bg-card-theme border border-theme rounded-2xl p-5 space-y-3 mb-6">
                <textarea
                    value={source} onChange={(e) => setSource(e.target.value)}
                    placeholder="Paste a topic or an existing caption/post to repurpose into every format…"
                    rows={3}
                    className="w-full bg-secondary border border-theme rounded-lg px-3 py-2.5 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none resize-y"
                />
                <div className="flex items-center gap-3">
                    <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand voice (optional)" className="flex-1 bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                    <button onClick={runRepurpose} disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-50">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {loading ? 'Repurposing…' : 'Repurpose'}
                    </button>
                </div>
            </div>
            )}

            {error && !loading && <div className="text-sm text-theme-secondary bg-card-theme border border-theme rounded-xl px-4 py-3 mb-5">{error}</div>}

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="aspect-[4/5] bg-secondary rounded-2xl animate-pulse" />
                    <div className="space-y-2"><div className="h-24 bg-secondary rounded-xl animate-pulse" /><div className="h-12 bg-secondary rounded-xl animate-pulse" /></div>
                </div>
            )}

            {!loading && mode === 'create' && result && p && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Visual */}
                    <div>
                        {result.image ? (
                            <div className="relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={result.image} alt={p.visualConcept} className="w-full rounded-2xl border border-theme" />
                                <a href={result.image} download="nyx-post.jpg" className="absolute top-3 right-3 inline-flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Download className="h-3 w-3" /> Save
                                </a>
                            </div>
                        ) : (
                            <div className="aspect-[4/5] bg-secondary rounded-2xl border border-theme flex items-center justify-center text-theme-secondary text-sm p-4 text-center">Image didn’t generate — the free service may be busy. Try again.</div>
                        )}
                        {p.visualConcept && <p className="text-xs text-theme-secondary mt-2">{p.visualConcept}</p>}
                    </div>

                    {/* Copy */}
                    <div className="space-y-4">
                        <div className="bg-card-theme border border-theme rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-theme-primary text-sm">Caption</h3>
                                <button onClick={() => copy('cap', fullCaption)} className="inline-flex items-center gap-1 text-xs text-theme-secondary hover:text-purple-500"><Copy className="h-3 w-3" /> {copied === 'cap' ? 'Copied' : 'Copy all'}</button>
                            </div>
                            <p className="text-sm text-theme-primary whitespace-pre-wrap leading-relaxed">{p.caption}</p>
                            <p className="text-xs text-purple-500 mt-2 break-words">{p.hashtags.map((h) => `#${h}`).join(' ')}</p>
                        </div>

                        {p.hooks.length > 0 && (
                            <div className="bg-card-theme border border-theme rounded-2xl p-4">
                                <h3 className="font-bold text-theme-primary text-sm mb-2">Alternative hooks</h3>
                                <ul className="space-y-1.5">
                                    {p.hooks.map((h, i) => (
                                        <li key={i} className="flex items-start justify-between gap-2 text-sm text-theme-secondary">
                                            <span>{h}</span>
                                            <button onClick={() => copy(`h${i}`, h)} className="shrink-0 text-theme-secondary hover:text-purple-500"><Copy className="h-3 w-3" /></button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result.patterns.length > 0 && (
                            <p className="text-[11px] text-theme-secondary">Built using winning patterns from {handles}: {result.patterns.slice(0, 2).join('; ')}…</p>
                        )}
                        {p.provider && <p className="text-[10px] text-theme-secondary/70">text via {p.provider} · image via free Flux</p>}
                    </div>
                </div>
            )}

            {!loading && mode === 'repurpose' && pack && <RepurposeView pack={pack} copy={copy} copied={copied} />}

            {!loading && !result && !pack && !error && (
                <div className="bg-card-theme border border-theme rounded-2xl p-12 flex flex-col items-center text-center">
                    <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"><Wand2 className="h-8 w-8 text-purple-500" /></div>
                    <p className="mt-5 text-theme-primary font-semibold">{mode === 'create' ? 'Make a post in one click' : 'Turn one idea into a week of content'}</p>
                    <p className="mt-1 text-sm text-theme-secondary max-w-md">{mode === 'create' ? 'Type a topic, optionally name a few @accounts to learn from, and get a caption, hooks, hashtags, and a matching visual — all free.' : 'Paste one idea or an old post and get a caption, carousel, reel script, story, and tweet — all on-brand, all free.'}</p>
                </div>
            )}
        </div>
    );
}

function RepCard({ k, title, body, children, copy, copied }: { k: string; title: string; body: string; children?: ReactNode; copy: (k: string, t: string) => void; copied: string }) {
    return (
        <div className="bg-card-theme border border-theme rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-theme-primary text-sm">{title}</h3>
                <button onClick={() => copy(k, body)} className="inline-flex items-center gap-1 text-xs text-theme-secondary hover:text-purple-500"><Copy className="h-3 w-3" /> {copied === k ? 'Copied' : 'Copy'}</button>
            </div>
            {children}
        </div>
    );
}

function RepurposeView({ pack, copy, copied }: { pack: Pack; copy: (k: string, t: string) => void; copied: string }) {
    const tags = pack.hashtags.map((h) => `#${h}`).join(' ');
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <RepCard k="rp-cap" title="Feed caption" body={`${pack.caption}\n\n${tags}`} copy={copy} copied={copied}>
                <p className="text-sm text-theme-primary whitespace-pre-wrap leading-relaxed">{pack.caption}</p>
                <p className="text-xs text-purple-500 mt-2 break-words">{tags}</p>
            </RepCard>
            <RepCard k="rp-car" title="Carousel slides" body={pack.carousel.map((s, i) => `${i + 1}. ${s}`).join('\n')} copy={copy} copied={copied}>
                <ol className="text-sm text-theme-primary space-y-1.5 list-decimal pl-4">{pack.carousel.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </RepCard>
            <RepCard k="rp-reel" title="Reel script" body={`Hook: ${pack.reel.hook}\n${pack.reel.scenes.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nCTA: ${pack.reel.cta}`} copy={copy} copied={copied}>
                <p className="text-sm text-theme-primary"><span className="font-semibold">Hook:</span> {pack.reel.hook}</p>
                <ol className="text-sm text-theme-secondary space-y-1 list-decimal pl-4 my-1.5">{pack.reel.scenes.map((s, i) => <li key={i}>{s}</li>)}</ol>
                <p className="text-sm text-theme-primary"><span className="font-semibold">CTA:</span> {pack.reel.cta}</p>
            </RepCard>
            <div className="space-y-5">
                <RepCard k="rp-story" title="Story" body={pack.story} copy={copy} copied={copied}><p className="text-sm text-theme-primary whitespace-pre-wrap">{pack.story}</p></RepCard>
                <RepCard k="rp-tweet" title="X / Twitter" body={pack.tweet} copy={copy} copied={copied}><p className="text-sm text-theme-primary">{pack.tweet}</p></RepCard>
            </div>
            {pack.provider && <p className="text-[10px] text-theme-secondary/70 md:col-span-2">via {pack.provider} · free</p>}
        </div>
    );
}
