import { scrapeProfilePosts } from '@/lib/services/instagram-scraper';
import { generateText } from '@/lib/llm/text';

// Winner mining (#3): scan niche accounts, rank their top posts by engagement,
// and have the free LLM extract WHY each worked + the cross-cutting patterns.
// Reuses the IG scraper + the free LLM chain. Foundation for #4 (content factory).

export interface WinnerPost {
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
    format: string;
    hook: string;
    topic: string;
    whyItWorked: string;
}

export interface WinnerResult {
    topPosts: WinnerPost[];
    patterns: string[];
    recommendations: string[];
    scanned: number;
    provider?: string;
}

function stripToJson(s: string): string {
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : s;
    const a = body.indexOf('{'), b = body.lastIndexOf('}');
    return a >= 0 && b > a ? body.slice(a, b + 1) : body;
}
function arr(v: unknown): string[] {
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

const SYSTEM = `You are a content strategist studying what performs on Instagram. Given a niche's TOP-PERFORMING posts (already ranked by engagement), analyze why each works and extract the patterns worth copying. Return ONLY JSON, no markdown:
{
  "posts": [{"index": <int matching the input #>, "format": "<reel | carousel | photo>", "hook": "<the hook/opening angle>", "topic": "<topic or theme>", "whyItWorked": "<one concise sentence>"}],
  "patterns": ["<3-5 cross-cutting patterns across these winners — formats, hooks, topics, posting style>"],
  "recommendations": ["<3-5 concrete things to replicate in your own content>"]
}`;

export async function mineWinners(handles: string[], perAccount = 12, topN = 8): Promise<WinnerResult> {
    const clean = handles.map((h) => h.replace(/^@/, '').trim()).filter(Boolean);
    // Scrape accounts SEQUENTIALLY — Instagram throttles concurrent profile
    // requests, which makes them time out. One at a time is slower but reliable.
    const posts = [];
    for (const h of clean) {
        try {
            posts.push(...(await scrapeProfilePosts(h, perAccount)));
        } catch { /* skip a failed account, keep the rest */ }
    }

    const scored = posts.map((p) => ({
        ...p,
        isVideo: p.videoViewCount > 0 || Boolean(p.videoUrl),
        engagement: (p.likesCount || 0) + (p.commentsCount || 0) * 3,
    }));
    scored.sort((a, b) => b.engagement - a.engagement);
    const top = scored.slice(0, topN);

    const result: WinnerResult = { topPosts: [], patterns: [], recommendations: [], scanned: posts.length };
    if (top.length === 0) return result;

    const list = top.map((p, i) =>
        `#${i}: @${p.ownerUsername} | ${p.isVideo ? 'video/reel' : 'image/carousel'} | ${p.likesCount} likes, ${p.commentsCount} comments${p.videoViewCount ? `, ${p.videoViewCount} views` : ''} | caption: ${(p.caption || '').slice(0, 160).replace(/\n/g, ' ')}`,
    ).join('\n');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let analysis: any = {};
    try {
        const r = await generateText({ system: SYSTEM, prompt: `Top posts:\n${list}`, maxTokens: 1100 });
        result.provider = r.provider;
        analysis = JSON.parse(stripToJson(r.text));
        result.patterns = arr(analysis.patterns);
        result.recommendations = arr(analysis.recommendations);
    } catch {
        // fall through — still return the ranked posts without analysis
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byIndex = new Map<number, any>();
    if (Array.isArray(analysis.posts)) for (const a of analysis.posts) byIndex.set(Number(a.index), a);

    result.topPosts = top.map((p, i) => {
        const a = byIndex.get(i) || {};
        return {
            shortcode: p.shortcode, url: p.url, ownerUsername: p.ownerUsername, caption: p.caption,
            displayUrl: p.displayUrl, likesCount: p.likesCount, commentsCount: p.commentsCount,
            videoViewCount: p.videoViewCount, isVideo: p.isVideo, engagement: p.engagement,
            format: String(a.format || (p.isVideo ? 'reel' : 'photo')),
            hook: String(a.hook || ''), topic: String(a.topic || ''), whyItWorked: String(a.whyItWorked || ''),
        };
    });
    return result;
}
