import { scrapeInstagramProfile } from '@/lib/services/instagram-scraper';
import { generateText } from '@/lib/llm/text';
import type { RawLead } from './types';

// Client-finder: turn a discovered business into a sales prospect — find its
// Instagram, assess how weak its social presence is (= how good a prospect it
// is for NYX's content services), and draft a personalized outreach pitch.
// Reuses the IG scraper + the free LLM chain.

export interface ProspectAssessment {
    igHandle: string | null;
    igFollowers: string | null;
    igPostCount: number;
    igFound: boolean;
    opportunity: number; // 1-100, higher = weaker presence = better prospect
    weaknesses: string;
    pitch: string;
    provider?: string;
}

const NON_PROFILE = new Set(['p', 'reel', 'reels', 'explore', 'accounts', 'about', 'developer', 'legal', 'directory', 'tv', 'stories']);

/** Scan a business website for an instagram.com profile link. */
export async function findInstagramHandle(website?: string): Promise<string | null> {
    if (!website) return null;
    try {
        const url = website.startsWith('http') ? website : `https://${website}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const html = await res.text();
        const m = html.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
        if (!m) return null;
        const handle = m[1].replace(/\/$/, '');
        if (!handle || NON_PROFILE.has(handle.toLowerCase())) return null;
        return handle;
    } catch {
        return null;
    }
}

// Fallback when the website has no IG link: search Instagram by business name.
// Conservative — only accept a match whose handle/name clearly overlaps the
// business name, so we don't pitch off a stranger's account.
export async function searchInstagramHandle(name: string): Promise<string | null> {
    const q = name.trim();
    if (!q) return null;
    try {
        const res = await fetch(`https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(q)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'X-IG-App-ID': '936619743392459' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users = (data.users || []).map((u: any) => u.user).filter(Boolean);
        const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = norm(name);
        if (!target) return null;
        for (const u of users.slice(0, 5)) {
            const uname = norm(u.username), full = norm(u.full_name);
            if (uname && (uname.includes(target) || target.includes(uname))) return u.username;
            if (full && (full.includes(target) || target.includes(full))) return u.username;
        }
        return null;
    } catch {
        return null;
    }
}

function stripToJson(s: string): string {
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : s;
    const a = body.indexOf('{'), b = body.lastIndexOf('}');
    return a >= 0 && b > a ? body.slice(a, b + 1) : body;
}

function normalizeHandle(raw?: string): string | null {
    if (!raw) return null;
    const h = raw.replace(/^@/, '').replace(/.*instagram\.com\//i, '').replace(/[/?#].*$/, '').trim();
    return h || null;
}

const SYSTEM = `You are a sales analyst for NYX, a creative studio that sells Instagram content creation + social media management to small businesses. Given a business and its current Instagram situation, judge how good a SALES PROSPECT they are — a HIGH opportunity score means a weak, inactive, or missing social presence that NYX could obviously improve. Return ONLY JSON, no prose, no markdown:
{"opportunity": <integer 1-100>, "weaknesses": "<1-2 sentences on what's weak about their social presence>", "pitch": "<a short warm outreach DM, 3-4 sentences, from NYX to this business, referencing their ACTUAL situation, ending with a soft call to action>"}
If their Instagram could not be located, do NOT claim they have none — hedge with phrasing like "if you're not active on Instagram yet" or "we couldn't find your Instagram — if you have one, …".`;

export interface IgResolution {
    handle: string | null;
    followers: string | null;
    postCount: number;
    found: boolean;
    recent: string;
    bio: string;
}

/** Resolve a business's Instagram: handle (field → website link → name search),
 *  then scrape the profile. Shared by the prospect pitch and the full report. */
export async function resolveInstagram(lead: Pick<RawLead, 'name' | 'website' | 'instagram'>): Promise<IgResolution> {
    let handle = normalizeHandle(lead.instagram);
    if (!handle) handle = await findInstagramHandle(lead.website);
    if (!handle) handle = await searchInstagramHandle(lead.name);

    const out: IgResolution = { handle, followers: null, postCount: 0, found: false, recent: '', bio: '' };
    if (handle) {
        const prof = await scrapeInstagramProfile(handle);
        if (!prof.isMock) {
            out.found = true;
            out.followers = prof.followersCount;
            out.postCount = prof.posts.length;
            out.bio = prof.biography;
            out.recent = prof.posts.map((p, i) => `(${i + 1}) ${(p.caption || '').slice(0, 120)} [${p.likes} likes]`).join('\n');
        }
    }
    return out;
}

export async function assessProspect(lead: Pick<RawLead, 'name' | 'category' | 'website' | 'instagram' | 'address'>): Promise<ProspectAssessment> {
    const ig = await resolveInstagram(lead);
    const handle = ig.handle;
    const igFollowers = ig.followers;
    const igPostCount = ig.postCount;
    const igFound = ig.found;
    const recent = ig.recent;

    const igStatus = igFound
        ? `On Instagram as @${handle}: ${igFollowers} followers. Recent posts:\n${recent || '(none found)'}`
        : handle
            ? `An Instagram handle @${handle} was found but couldn't be loaded (likely inactive or private).`
            : 'We could NOT locate an Instagram account for them — they may not have one, or it simply isn\'t linked anywhere we could find. Do NOT state as fact that they have no Instagram; hedge.';

    const prompt = `Business: ${lead.name}\nCategory: ${lead.category || 'unknown'}\nLocation: ${lead.address || 'unknown'}\nWebsite: ${lead.website || 'none'}\nInstagram: ${igStatus}`;

    let opportunity = igFound ? 50 : 75; // no IG defaults to a stronger prospect
    let weaknesses = '';
    let pitch = '';
    let provider: string | undefined;
    try {
        const r = await generateText({ system: SYSTEM, prompt, maxTokens: 500 });
        provider = r.provider;
        const j = JSON.parse(stripToJson(r.text));
        if (Number.isFinite(Number(j.opportunity))) opportunity = Math.max(1, Math.min(100, Number(j.opportunity)));
        weaknesses = String(j.weaknesses || '');
        pitch = String(j.pitch || '');
    } catch {
        // leave defaults; caller still gets the IG stats
    }

    return { igHandle: handle, igFollowers, igPostCount, igFound, opportunity, weaknesses, pitch, provider };
}
