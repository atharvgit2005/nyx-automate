import { scrapeProfilePosts } from '@/lib/services/instagram-scraper';
import { generateText } from '@/lib/llm/text';

// Trend radar (#7): watch accounts and flag posts that SPIKE above that account's
// own normal — a fresh trend to ride early. Unlike winner mining (#3, absolute
// top posts), this is RELATIVE: a post doing unusually well for its account.

export interface Breakout {
    shortcode: string;
    url: string;
    ownerUsername: string;
    caption: string;
    displayUrl: string;
    likesCount: number;
    commentsCount: number;
    videoViewCount: number;
    isVideo: boolean;
    engagement: number;
    baseline: number;
    spike: number; // engagement / baseline (e.g. 2.4 = 2.4x the account's normal)
    timestamp: string;
}

export interface RadarResult {
    breakouts: Breakout[];
    summary: string;
    scanned: number;
    provider?: string;
}

function median(xs: number[]): number {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function scanRadar(handles: string[], perAccount = 12, threshold = 1.6, sinceDays = 30): Promise<RadarResult> {
    const clean = handles.map((h) => h.replace(/^@/, '').trim()).filter(Boolean);
    const cutoff = Date.now() - sinceDays * 86400_000;

    const breakouts: Breakout[] = [];
    let scanned = 0;
    for (const h of clean) {
        let posts;
        try { posts = await scrapeProfilePosts(h, perAccount); } catch { continue; }
        scanned += posts.length;
        const eng = posts.map((p) => (p.likesCount || 0) + (p.commentsCount || 0) * 3);
        const baseline = median(eng);
        if (baseline <= 0) continue;
        posts.forEach((p, i) => {
            const ts = p.timestamp ? new Date(p.timestamp).getTime() : 0;
            if (ts && ts < cutoff) return; // only "now" — recent posts
            const spike = eng[i] / baseline;
            if (spike >= threshold) {
                breakouts.push({
                    shortcode: p.shortcode, url: p.url, ownerUsername: p.ownerUsername, caption: p.caption,
                    displayUrl: p.displayUrl, likesCount: p.likesCount, commentsCount: p.commentsCount,
                    videoViewCount: p.videoViewCount, isVideo: p.videoViewCount > 0 || Boolean(p.videoUrl),
                    engagement: eng[i], baseline: Math.round(baseline), spike: Math.round(spike * 10) / 10,
                    timestamp: p.timestamp,
                });
            }
        });
    }
    breakouts.sort((a, b) => b.spike - a.spike);

    const result: RadarResult = { breakouts, summary: '', scanned };
    if (breakouts.length) {
        const list = breakouts.slice(0, 10).map((b) =>
            `@${b.ownerUsername} (${b.spike}x normal, ${b.isVideo ? 'reel' : 'photo'}): ${(b.caption || '').slice(0, 120).replace(/\n/g, ' ')}`,
        ).join('\n');
        try {
            const r = await generateText({
                system: 'You are a social trend analyst. Given posts that are spiking above their accounts\' normal engagement, write 2-3 sentences on what is trending RIGHT NOW — the common topics, formats, or angles — and one tip to ride it. Plain text, no markdown.',
                prompt: `Breakout posts:\n${list}`,
                maxTokens: 300,
            });
            result.summary = r.text.trim();
            result.provider = r.provider;
        } catch { /* breakouts still returned without summary */ }
    }
    return result;
}
