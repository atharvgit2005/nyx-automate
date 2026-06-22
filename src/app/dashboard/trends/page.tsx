'use client';

import { useState } from 'react';
import {
    Instagram, Search, Heart, MessageCircle, Send, Bookmark,
    Loader2, Sparkles, AlertTriangle, Play, Hash, AtSign,
    Trophy, Lightbulb, Flame,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

// Mirrors NormalizedPost from src/lib/services/instagram-scraper.ts
interface Post {
    id: string;
    shortcode: string;
    url: string;
    ownerUsername: string;
    caption: string;
    displayUrl: string;
    videoUrl: string;
    videoViewCount: number;
    likesCount: number;
    commentsCount: number;
    timestamp: string;
    hashtags: string[];
    musicName: string;
    musicAuthor: string;
    source: 'hashtag' | 'profile';
    sourceInput: string;
}

interface Sentiment {
    overall_sentiment: number | null;
    tool_usefulness: number | null;
    common_questions: string[];
    key_insights: string;
    provider?: string;
}

interface WinnerPost {
    shortcode: string; url: string; ownerUsername: string; caption: string; displayUrl: string;
    likesCount: number; commentsCount: number; videoViewCount: number; isVideo: boolean;
    format: string; hook: string; topic: string; whyItWorked: string;
}
interface WinnerResult { topPosts: WinnerPost[]; patterns: string[]; recommendations: string[]; scanned: number; provider?: string }
interface Breakout {
    shortcode: string; url: string; ownerUsername: string; caption: string; displayUrl: string;
    likesCount: number; commentsCount: number; videoViewCount: number; isVideo: boolean;
    engagement: number; baseline: number; spike: number; timestamp: string;
}
interface RadarResult { breakouts: Breakout[]; summary: string; scanned: number; provider?: string }

const IG_GRADIENT = 'linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)';

function compact(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function timeAgo(iso: string): string {
    if (!iso) return '';
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 3600) return Math.max(1, Math.floor(d / 60)) + 'm';
    if (d < 86400) return Math.floor(d / 3600) + 'h';
    if (d < 604800) return Math.floor(d / 86400) + 'd';
    return Math.floor(d / 604800) + 'w';
}

export default function Trends() {
    const [query, setQuery] = useState('@nasa, #space');
    const [limit, setLimit] = useState(9);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSession, setHasSession] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [mode, setMode] = useState<'sentiment' | 'winners' | 'radar'>('sentiment');
    const [winners, setWinners] = useState<WinnerResult | null>(null);
    const [radar, setRadar] = useState<RadarResult | null>(null);

    async function scan() {
        const tokens = query.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
        const profiles = tokens.filter((t) => t.startsWith('@')).map((t) => t.slice(1));
        const hashtags = tokens.filter((t) => !t.startsWith('@')).map((t) => t.replace(/^#/, ''));
        if (!profiles.length && !hashtags.length) {
            setError('Enter at least one @profile or #hashtag.');
            return;
        }
        setLoading(true);
        setError('');
        setScanned(true);

        if (mode === 'winners') {
            setPosts([]); setWinners(null);
            try {
                if (!profiles.length) throw new Error('Winner mining works on profiles — enter @handles (e.g. @nike @adidas).');
                const res = await fetch('/api/insights/winners', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handles: profiles, perAccount: limit, topN: 8 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Winner mining failed');
                setWinners(data);
                if (!data.topPosts?.length) setError('No posts found — check the @handles are public.');
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Winner mining failed'); setWinners(null);
            } finally { setLoading(false); }
            return;
        }

        if (mode === 'radar') {
            setPosts([]); setRadar(null);
            try {
                if (!profiles.length) throw new Error('Trend radar watches profiles — enter @handles to watch.');
                const res = await fetch('/api/insights/radar', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handles: profiles, perAccount: limit, threshold: 1.5, sinceDays: 45 }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Radar failed');
                setRadar(data);
                if (!data.breakouts?.length) setError(`No breakouts — nothing is spiking above normal for ${profiles.map((p) => '@' + p).join(', ')} right now.`);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Radar failed'); setRadar(null);
            } finally { setLoading(false); }
            return;
        }

        setWinners(null); setRadar(null);
        try {
            const res = await fetch('/api/scrape/instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'discover', profiles, hashtags, limit }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Scan failed');
            setPosts(data.posts || []);
            setHasSession(Boolean(data.hasSession));
            if (!data.posts?.length) {
                setError(
                    hashtags.length && !profiles.length
                        ? 'Hashtag discovery isn’t available on the free scraper (Instagram locked that endpoint). Search a profile instead, e.g. @nasa.'
                        : 'No posts found — check the handle is spelled right and the account is public.'
                );
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Scan failed');
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <PageHeader
                kicker="Audience Intelligence"
                title="Instagram Trends"
                subtitle="Scan profiles & hashtags, read the room with AI sentiment."
                icon={<Instagram className="h-7 w-7" style={{ color: '#dc2743' }} />}
            />

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
                {([['sentiment', 'Read the room'], ['winners', "What's working"], ['radar', 'Trending now']] as const).map(([m, label]) => (
                    <button
                        key={m}
                        onClick={() => { setMode(m); setError(''); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${mode === m ? 'text-white border-transparent' : 'bg-secondary border-theme text-theme-secondary hover:text-theme-primary'}`}
                        style={mode === m ? { background: IG_GRADIENT } : undefined}
                    >
                        {label}
                    </button>
                ))}
                <span className="self-center text-[11px] text-theme-secondary ml-1">
                    {mode === 'sentiment' ? 'comments → AI sentiment' : mode === 'winners' ? 'rank top posts → why they work' : 'posts spiking above their account’s normal'}
                </span>
            </div>

            {/* Search bar */}
            <div className="bg-card-theme border border-theme rounded-2xl p-4 mb-5">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-secondary" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !loading && scan()}
                            placeholder="@profile, #hashtag, …"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-theme text-sm text-theme-primary placeholder:text-theme-secondary outline-none focus:ring-2 focus:ring-[#dc2743]/40"
                        />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-secondary border border-theme px-3">
                        <span className="text-xs text-theme-secondary whitespace-nowrap">Per source</span>
                        <input
                            type="number" min={1} max={50} value={limit}
                            onChange={(e) => setLimit(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                            className="w-12 bg-transparent text-sm text-theme-primary outline-none"
                        />
                    </div>
                    <button
                        onClick={scan}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
                        style={{ background: IG_GRADIENT }}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        {loading ? 'Scanning…' : 'Scan'}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 px-1 text-[11px] text-theme-secondary">
                    <span className="flex items-center gap-1"><AtSign className="h-3 w-3" /> profile posts — no login needed</span>
                    <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> hashtags &amp; comments — need IG_SESSIONID</span>
                </div>
            </div>

            {/* Session warning */}
            {hasSession === false && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-3 mb-5 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>No <code className="font-mono">IG_SESSIONID</code> set — hashtag discovery and comment-based sentiment are off. Profile posts &amp; caption sentiment still work. Add a throwaway-account cookie to unlock the rest.</span>
                </div>
            )}

            {/* States */}
            {error && !loading && (
                <div className="text-sm text-theme-secondary bg-card-theme border border-theme rounded-xl px-4 py-3 mb-5">{error}</div>
            )}

            {loading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                    {Array.from({ length: limit > 6 ? 6 : limit }).map((_, i) => (
                        <div key={i} className="bg-card-theme border border-theme rounded-2xl overflow-hidden animate-pulse">
                            <div className="h-12 bg-secondary" />
                            <div className="aspect-square bg-secondary" />
                            <div className="h-16 bg-card-theme" />
                        </div>
                    ))}
                </div>
            )}

            {!loading && posts.length > 0 && (
                <>
                    <p className="text-xs text-theme-secondary mb-3">{posts.length} posts</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                        {posts.map((p) => <PostCard key={p.id + p.shortcode} post={p} />)}
                    </div>
                </>
            )}

            {!loading && winners && winners.topPosts.length > 0 && <WinnersView data={winners} />}

            {!loading && radar && radar.breakouts.length > 0 && <RadarView data={radar} />}

            {!loading && !scanned && (
                <div className="bg-card-theme border border-theme rounded-2xl p-12 flex flex-col items-center text-center">
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: IG_GRADIENT }}>
                        <Instagram className="h-8 w-8 text-white" />
                    </div>
                    <p className="mt-5 text-theme-primary font-semibold">Scan an Instagram feed</p>
                    <p className="mt-1 text-sm text-theme-secondary max-w-md">
                        Enter profiles and hashtags above. Posts come from your own free scraper; AI sentiment runs on the free Groq/Gemini chain.
                    </p>
                </div>
            )}
        </div>
    );
}

function PostCard({ post }: { post: Post }) {
    const [imgOk, setImgOk] = useState(true);
    const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [sentiment, setSentiment] = useState<Sentiment | null>(null);
    const isVideo = post.videoViewCount > 0 || Boolean(post.videoUrl);

    async function analyze() {
        setState('loading');
        try {
            // 1) pull comments (best-effort), 2) run free sentiment
            let comments = '';
            try {
                const cr = await fetch('/api/scrape/instagram', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'comments', url: post.url, limit: 15 }),
                });
                const cd = await cr.json();
                comments = cd.concatenated_text || '';
            } catch { /* fall back to caption-only */ }

            const sr = await fetch('/api/insights/sentiment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caption: post.caption, comments }),
            });
            const sd = await sr.json();
            if (!sr.ok) throw new Error(sd.error || 'Sentiment failed');
            setSentiment(sd);
            setState('done');
        } catch {
            setState('error');
        }
    }

    return (
        <div className="bg-card-theme border border-theme rounded-2xl overflow-hidden flex flex-col">
            {/* header */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                <div className="h-9 w-9 rounded-full p-[2px]" style={{ background: IG_GRADIENT }}>
                    <div className="h-full w-full rounded-full bg-card-theme flex items-center justify-center text-xs font-bold text-theme-primary uppercase">
                        {post.ownerUsername.slice(0, 2)}
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    <a href={`https://www.instagram.com/${post.ownerUsername}/`} target="_blank" rel="noreferrer"
                        className="block text-sm font-semibold text-theme-primary truncate hover:underline">
                        {post.ownerUsername || 'unknown'}
                    </a>
                    <span className="block text-[11px] text-theme-secondary truncate">
                        {post.source === 'hashtag' ? `#${post.sourceInput}` : 'profile'}
                    </span>
                </div>
            </div>

            {/* media */}
            <a href={post.url} target="_blank" rel="noreferrer" className="relative block aspect-square bg-secondary group">
                {imgOk && post.displayUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={post.displayUrl} alt={post.caption.slice(0, 80) || 'post'}
                        referrerPolicy="no-referrer" loading="lazy"
                        onError={() => setImgOk(false)}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-theme-secondary"><Instagram className="h-10 w-10 opacity-30" /></div>
                )}
                {isVideo && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full">
                        <Play className="h-3 w-3 fill-white" /> {compact(post.videoViewCount)}
                    </span>
                )}
            </a>

            {/* actions */}
            <div className="flex items-center gap-4 px-3.5 pt-2.5 text-theme-primary">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
                <Send className="h-5 w-5" />
                <Bookmark className="h-5 w-5 ml-auto" />
            </div>

            {/* counts + caption */}
            <div className="px-3.5 py-2 flex-1">
                <p className="text-sm font-semibold text-theme-primary">{compact(post.likesCount)} likes</p>
                <p className="text-sm text-theme-primary mt-1 line-clamp-2">
                    <span className="font-semibold">{post.ownerUsername} </span>
                    {post.caption || <span className="text-theme-secondary">No caption</span>}
                </p>
                {post.hashtags.length > 0 && (
                    <p className="text-xs text-[#1e5a99] dark:text-[#5b9bd5] mt-1 line-clamp-1">
                        {post.hashtags.slice(0, 6).map((h) => `#${h}`).join(' ')}
                    </p>
                )}
                <p className="text-[11px] text-theme-secondary mt-1.5 uppercase tracking-wide">
                    {compact(post.commentsCount)} comments · {timeAgo(post.timestamp)} ago
                </p>
            </div>

            {/* sentiment */}
            <div className="border-t border-theme px-3.5 py-2.5">
                {state === 'idle' && (
                    <button onClick={analyze} className="flex items-center gap-1.5 text-sm font-medium text-theme-primary hover:opacity-80">
                        <Sparkles className="h-4 w-4" style={{ color: '#cc2366' }} /> Analyze sentiment
                    </button>
                )}
                {state === 'loading' && (
                    <span className="flex items-center gap-1.5 text-sm text-theme-secondary"><Loader2 className="h-4 w-4 animate-spin" /> Reading the comments…</span>
                )}
                {state === 'error' && (
                    <button onClick={analyze} className="text-sm text-amber-600 dark:text-amber-400">Analysis failed — retry</button>
                )}
                {state === 'done' && sentiment && <SentimentPanel s={sentiment} />}
            </div>
        </div>
    );
}

function WinnersView({ data }: { data: WinnerResult }) {
    return (
        <div className="space-y-5">
            {(data.patterns.length > 0 || data.recommendations.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-card-theme border border-theme rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><Flame className="h-4 w-4" style={{ color: '#dc2743' }} /><h3 className="font-bold text-theme-primary text-sm">What the winners share</h3></div>
                        <ul className="space-y-1.5">{data.patterns.map((x, i) => <li key={i} className="text-sm text-theme-secondary flex gap-2"><span style={{ color: '#dc2743' }}>•</span>{x}</li>)}</ul>
                    </div>
                    <div className="bg-card-theme border border-theme rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><Lightbulb className="h-4 w-4 text-amber-500" /><h3 className="font-bold text-theme-primary text-sm">Copy this in your content</h3></div>
                        <ul className="space-y-1.5">{data.recommendations.map((x, i) => <li key={i} className="text-sm text-theme-secondary flex gap-2"><span className="text-amber-500">▸</span>{x}</li>)}</ul>
                    </div>
                </div>
            )}
            <div>
                <p className="text-xs text-theme-secondary mb-3 flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> top {data.topPosts.length} of {data.scanned} scanned, by engagement</p>
                <div className="space-y-3">
                    {data.topPosts.map((p, i) => (
                        <a key={p.shortcode} href={p.url} target="_blank" rel="noreferrer" className="flex gap-3 bg-card-theme border border-theme rounded-2xl p-3 hover:border-[#dc2743]/40 transition-colors">
                            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: IG_GRADIENT }}>{i + 1}</span>
                            <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-secondary">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {p.displayUrl ? <img src={p.displayUrl} referrerPolicy="no-referrer" loading="lazy" alt="" className="w-full h-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-theme-primary">@{p.ownerUsername}</span>
                                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-theme-secondary border border-theme">{p.format}</span>
                                    <span className="text-xs text-theme-secondary">{compact(p.likesCount)} likes · {compact(p.commentsCount)} comments{p.videoViewCount ? ` · ${compact(p.videoViewCount)} views` : ''}</span>
                                </div>
                                {p.hook && <p className="text-sm text-theme-primary mt-1 line-clamp-1">{p.hook}</p>}
                                {p.whyItWorked && <p className="text-xs text-theme-secondary mt-0.5">{p.whyItWorked}</p>}
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Dots({ value }: { value: number | null }) {
    const v = value || 0;
    return (
        <span className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i <= v ? '#dc2743' : 'rgba(120,120,120,0.3)' }} />
            ))}
        </span>
    );
}

function SentimentPanel({ s }: { s: Sentiment }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-5 text-xs text-theme-secondary">
                <span className="flex items-center gap-1.5">Sentiment <Dots value={s.overall_sentiment} /></span>
                <span className="flex items-center gap-1.5">Usefulness <Dots value={s.tool_usefulness} /></span>
            </div>
            {s.key_insights && <p className="text-xs text-theme-primary leading-relaxed">{s.key_insights}</p>}
            {s.common_questions.length > 0 && (
                <ul className="space-y-0.5">
                    {s.common_questions.slice(0, 3).map((q, i) => (
                        <li key={i} className="text-[11px] text-theme-secondary flex gap-1.5"><MessageCircle className="h-3 w-3 mt-0.5 shrink-0" />{q}</li>
                    ))}
                </ul>
            )}
            {s.provider && <p className="text-[10px] text-theme-secondary/70">via {s.provider}</p>}
        </div>
    );
}

function RadarView({ data }: { data: RadarResult }) {
    return (
        <div className="space-y-4">
            {data.summary && (
                <div className="bg-card-theme border border-theme rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1"><Flame className="h-4 w-4" style={{ color: '#dc2743' }} /><h3 className="font-bold text-theme-primary text-sm">Trending right now</h3></div>
                    <p className="text-sm text-theme-secondary leading-relaxed">{data.summary}</p>
                </div>
            )}
            <p className="text-xs text-theme-secondary">{data.breakouts.length} breakouts from {data.scanned} posts scanned</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.breakouts.map((b) => (
                    <div key={b.shortcode} className="bg-card-theme border border-theme rounded-2xl p-4 flex gap-3">
                        <span className="shrink-0 self-start flex items-center gap-1 text-xs font-bold text-white px-2 py-1 rounded-md" style={{ background: IG_GRADIENT }}><Flame className="h-3 w-3" /> {b.spike}x</span>
                        <div className="min-w-0 flex-1">
                            <a href={b.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-theme-primary hover:underline">@{b.ownerUsername}</a>
                            <p className="text-[11px] text-theme-secondary">{compact(b.likesCount)} likes · {b.isVideo ? 'reel' : 'photo'} · {timeAgo(b.timestamp)} ago · {b.spike}x its usual</p>
                            <p className="text-sm text-theme-primary mt-1 line-clamp-2">{b.caption || <span className="text-theme-secondary">No caption</span>}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
