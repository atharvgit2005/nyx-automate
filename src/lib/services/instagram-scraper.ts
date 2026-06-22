import * as cheerio from 'cheerio';
import axios from 'axios';

export interface ScrapedProfile {
    username: string;
    fullName: string;
    biography: string;
    followersCount: string;
    posts: ScrapedPost[];
    transcript: string;
    /**
     * True when this profile is the synthetic fallback (all real scrape
     * strategies failed). Routes should NOT run AI analysis on a mock
     * profile - the analysis would be identical for every username and
     * appears to the user as "meta data instead of actual analysis."
     * Surface the failure to the UI instead.
     */
    isMock?: boolean;
}

export interface ScrapedPost {
    caption: string;
    likes: string;
    imageUrl: string;
}

function createTranscript(username: string, fullName: string, bio: string, followers: string, posts: ScrapedPost[]) {
    return `
    Profile: ${fullName} (@${username})
    Bio: ${bio}
    Followers: ${followers}
    
    Recent Content (Captions):
    ${posts.map((p, i) => `[Post ${i + 1}] ${p.caption}`).join('\n\n')}
  `;
}

// Strategy: Official IG Public API (Hidden)
async function scrapeWithIGApi(username: string): Promise<ScrapedProfile | null> {
    console.log(`[Strategy: IG API] Fetching info for @${username}...`);
    try {
        const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Instagram 219.0.0.12.117 Android',
                'X-IG-App-ID': '936619743392459',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'X-Requested-With': 'XMLHttpRequest'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (res.status !== 200) {
            console.warn(`[Strategy: IG API] Failed with status ${res.status}`);
            return null;
        }

        const data = await res.json();
        const user = data?.data?.user;
        if (!user) return null;

        const fullName = user.full_name || username;
        const biography = user.biography || 'Bio not available';

        const followersCountNum = user.edge_followed_by?.count || 0;
        const followersCount = followersCountNum >= 1000000
            ? (followersCountNum / 1000000).toFixed(1) + 'M'
            : followersCountNum >= 1000
                ? (followersCountNum / 1000).toFixed(1) + 'k'
                : followersCountNum.toString();

        const posts: ScrapedPost[] = [];
        const edges = user.edge_owner_to_timeline_media?.edges || [];

        for (let i = 0; i < Math.min(6, edges.length); i++) {
            const node = edges[i].node;
            const caption = node.edge_media_to_caption?.edges[0]?.node?.text || 'No caption';

            const likesNum = node.edge_liked_by?.count || 0;
            const likes = likesNum >= 1000000
                ? (likesNum / 1000000).toFixed(1) + 'M'
                : likesNum >= 1000
                    ? (likesNum / 1000).toFixed(1) + 'k'
                    : likesNum.toString();

            const imageUrl = node.display_url || '';

            if (imageUrl) {
                posts.push({ caption, likes, imageUrl });
            }
        }

        if (posts.length === 0) {
            console.warn('[Strategy: IG API] Found 0 posts. Account might be private.');
        } else {
            console.log(`[Strategy: IG API] Success! Found ${posts.length} posts for @${username}`);
        }

        return {
            username,
            fullName,
            biography,
            followersCount,
            posts,
            transcript: createTranscript(username, fullName, biography, followersCount, posts)
        };

    } catch (error: unknown) {
        console.error(`[Strategy: IG API] Error: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

// Strategy: Scrape a Public Web Viewer (Picuki)
// This bypasses Instagram's direct anti-scraping measures by using a public mirror.
async function scrapeWithPicuki(username: string): Promise<ScrapedProfile | null> {
    console.log(`[Strategy: Picuki Mirror] Fetching info for @${username}...`);
    try {
        const url = `https://www.picuki.com/profile/${username}`;
        const { data } = await axios.get(url, {
            headers: {
                // Mimic a real browser to avoid simplistic blocking
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            },
            timeout: 5000 // 5s timeout
        });

        const $ = cheerio.load(data);

        // 1. Extract Profile Info
        const fullName = $('.profile-name h1').text().trim() || username;
        const biography = $('.profile-description').text().trim() || 'Bio not available';
        const followersCount = $('.followed_by').text().replace('Followers', '').trim() || 'Unknown';

        // 2. Extract Posts
        const posts: ScrapedPost[] = [];
        $('.box-photo').each((i, el) => {
            if (i >= 6) return; // Limit to 6 posts

            const caption = $(el).find('.photo-description').text().trim() || 'No caption';
            const likes = $(el).find('.likes_photo').text().trim() || '0';
            const imageUrl = $(el).find('img').attr('src') || '';

            if (imageUrl) {
                posts.push({ caption, likes, imageUrl });
            }
        });

        if (posts.length === 0) {
            console.warn('[Strategy: Picuki] Found 0 posts. Account might be private or not found.');
            return null;
        }

        console.log(`[Strategy: Picuki] Success! Found ${posts.length} posts for @${username}`);

        return {
            username,
            fullName,
            biography,
            followersCount,
            posts,
            transcript: createTranscript(username, fullName, biography, followersCount, posts)
        };

    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error(`[Strategy: Picuki] Request failed: ${error.response?.status} ${error.response?.statusText}`);
        } else {
            console.error(`[Strategy: Picuki] Failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        return null; // Fallback to next strategy
    }
}

// Removed: Dumpoir mirror strategy. That mirror's HTML used `img.alt`
// as the post caption, but the alt content is generic page metadata
// ("Instagram photo by X • 2024 views"), not the real caption. Feeding
// that into Gemini produced identical-looking analysis for every brand
// (the "meta data instead of actual analysis" symptom). If a similar
// mirror with real captions appears later, add a new strategy function.

export async function scrapeInstagramProfile(username: string): Promise<ScrapedProfile> {
    // Run strategies concurrently to save time, since Vercel has a strict 10s limit.
    // Dropped Dumpoir from the rotation - its scraper used `img.alt` for the
    // post caption, which on that mirror is HTML metadata ("Instagram photo
    // by X • 2024 views") rather than real caption text. Feeding that into
    // Gemini produced generic, identical-looking analysis for every brand
    // (the "meta data instead of actual analysis" symptom).
    console.log(`[Scraper] Starting parallel scrape for @${username}`);

    // Promise.allSettled so a single rejection doesn't abort the rest.
    const settled = await Promise.allSettled([
        scrapeWithIGApi(username),
        scrapeWithPicuki(username),
    ]);

    const candidates = settled
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((p): p is ScrapedProfile => p !== null && p.posts.length > 0);

    // Pick the candidate with the most posts that have non-trivial captions.
    // Captions like "No caption", empty strings, or pure metadata score 0.
    const scored = candidates.map((c) => ({
        profile: c,
        score: c.posts.filter((p) => {
            const cap = (p.caption || '').trim();
            return cap.length > 8 && cap.toLowerCase() !== 'no caption';
        }).length,
    }));
    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 0) {
        console.log(`[Scraper] Best result: ${scored[0].profile.fullName} (score=${scored[0].score})`);
        return scored[0].profile;
    }

    console.warn('[Scraper] All real strategies failed or returned trivial content. Returning flagged mock.');
    return { ...getMockProfile(username), isMock: true };
}

// Mock Data Fallback
function getMockProfile(username: string): ScrapedProfile {
    // Context-aware mock posts
    const posts: ScrapedPost[] = [
        { caption: "Building the future of AI. Innovation never sleeps. #Tech #AI", likes: "1.2k", imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=60" },
        { caption: "Behind the scenes at our new office. Minimalism is key.", likes: "950", imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format&fit=crop&q=60" },
        { caption: "Just launched our new product! Check the link in bio.", likes: "2.1k", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60" },
        { caption: "Coffee and code. The perfect Sunday morning.", likes: "800", imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&auto=format&fit=crop&q=60" },
        { caption: "Speaking at the global tech summit next week! Cannot wait.", likes: "1.5k", imageUrl: "https://images.unsplash.com/photo-1475721027767-p753cce59d44?w=500&auto=format&fit=crop&q=60" },
        { caption: "Exploring new frontiers in generative art. Does this look real?", likes: "3.2k", imageUrl: "https://images.unsplash.com/photo-1549490349-8643362247b5?w=500&auto=format&fit=crop&q=60" }
    ];

    return {
        username,
        fullName: `${username} (Demo Mirror Failed)`,
        biography: "Creative Technologist • Building next-gen AI tools • Public Speaker",
        followersCount: "15.2k",
        posts,
        transcript: createTranscript(username, `${username} (Demo)`, "Creative Technologist • Building next-gen AI tools", "15.2k", posts)
    };
}

// ───────────────────────────────────────────────────────────────────────────
// FREE Audience-Intelligence scraping (hashtag discovery + comments).
//
// This is the free replacement for the paid Apify actors in
// `n8n/nyx-instagram-intelligence.json`. It reuses Instagram's hidden web API
// (the same one `scrapeWithIGApi` uses). Two endpoints — hashtag feeds and a
// post's comments — are gated by Instagram behind a logged-in cookie, so set
// `IG_SESSIONID` (the `sessionid` cookie from a throwaway account) for those to
// work. Profile posts and captions work without it; comments/hashtags degrade
// gracefully to empty when the cookie is missing or expired.
// ───────────────────────────────────────────────────────────────────────────

const IG_APP_ID = '936619743392459';

export interface NormalizedPost {
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
    videoDuration: number;
    dimensionsHeight: number;
    dimensionsWidth: number;
    timestamp: string; // ISO
    hashtags: string[];
    musicName: string;
    musicAuthor: string;
    source: 'hashtag' | 'profile';
    sourceInput: string; // the tag or username this post came from
}

export interface PostComments {
    url: string;
    shortcode: string;
    comments: { text: string; username: string; likeCount: number }[];
    concatenated_text: string;
    /** False when comments could not be read (no/expired IG_SESSIONID) so the
     *  caller knows to fall back to caption-only sentiment. */
    authed: boolean;
}

// IG_SESSIONID is needed for comments + hashtags, but it makes the public
// `web_profile_info` endpoint 302-redirect — so the cookie is opt-in per call.
function igHeaders(useCookie = true): Record<string, string> {
    const h: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-IG-App-ID': IG_APP_ID,
        'Accept': '*/*',
        'Sec-Fetch-Site': 'same-origin',
        'X-Requested-With': 'XMLHttpRequest',
    };
    const sid = process.env.IG_SESSIONID;
    if (useCookie && sid) h['Cookie'] = `sessionid=${sid}`;
    return h;
}

async function igGet(url: string, opts: { timeoutMs?: number; useCookie?: boolean } = {}): Promise<unknown | null> {
    const { timeoutMs = 12000, useCookie = true } = opts;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers: igHeaders(useCookie), signal: controller.signal });
        if (res.status !== 200) {
            console.warn(`[ig] ${res.status} for ${url.split('?')[0]}`);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.warn('[ig] fetch failed:', e instanceof Error ? e.message : String(e));
        return null;
    } finally {
        clearTimeout(t);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asText(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v.text || '';
}
function num(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

// Normalize the many slightly-different IG media shapes (hashtag section media,
// profile timeline node, single-post item) into one Apify-compatible object so
// the n8n workflow's field mapping barely changes between paid and free.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mediaToPost(m: any, source: 'hashtag' | 'profile', sourceInput: string): NormalizedPost {
    const code = m.code || m.shortcode || '';
    const caption = asText(m.caption);
    const hashtags = Array.from(new Set((caption.match(/#[\wÀ-ɏ]+/g) || []).map((h: string) => h.slice(1))));
    const img = m.image_versions2?.candidates?.[0]?.url || m.display_url || m.thumbnail_src || '';
    const vid = m.video_versions?.[0]?.url || m.video_url || '';
    const music = m.clips_metadata?.music_info?.music_asset_info || {};
    const epoch = m.taken_at ?? m.taken_at_timestamp;
    return {
        id: String(m.pk || m.id || code),
        shortcode: code,
        url: code ? `https://www.instagram.com/p/${code}/` : '',
        ownerUsername: m.user?.username || m.owner?.username || '',
        caption,
        displayUrl: img,
        videoUrl: vid,
        videoViewCount: num(m.play_count ?? m.view_count ?? m.video_view_count),
        likesCount: num(m.like_count ?? m.edge_liked_by?.count ?? m.edge_media_preview_like?.count),
        commentsCount: num(m.comment_count ?? m.edge_media_to_comment?.count),
        videoDuration: num(m.video_duration),
        dimensionsHeight: num(m.original_height ?? m.dimensions?.height),
        dimensionsWidth: num(m.original_width ?? m.dimensions?.width),
        timestamp: epoch ? new Date(num(epoch) * 1000).toISOString() : '',
        hashtags,
        musicName: music.title || '',
        musicAuthor: music.display_artist || '',
        source,
        sourceInput,
    };
}

function extractShortcode(s: string): string {
    const m = String(s).match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]+$/.test(s)) return s; // already a shortcode
    return '';
}

/** Discover recent posts for a hashtag. Needs IG_SESSIONID (IG gates the tag
 *  feed behind login). Returns [] if not configured / blocked. */
export async function scrapeHashtagPosts(tag: string, limit = 12): Promise<NormalizedPost[]> {
    const clean = String(tag).replace(/^#/, '').trim();
    if (!clean) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await igGet(`https://www.instagram.com/api/v1/tags/web_info/?tag_name=${encodeURIComponent(clean)}`);
    const out: NormalizedPost[] = [];
    const sections = [...(data?.data?.top?.sections || []), ...(data?.data?.recent?.sections || [])];
    for (const s of sections) {
        const medias = s?.layout_content?.medias || [];
        for (const mm of medias) {
            const m = mm.media || mm;
            if (m?.code) out.push(mediaToPost(m, 'hashtag', clean));
            if (out.length >= limit) return out;
        }
    }
    if (!out.length && !process.env.IG_SESSIONID) {
        console.warn(`[ig] hashtag #${clean}: 0 posts — set IG_SESSIONID to enable hashtag discovery.`);
    }
    return out;
}

/** Recent posts for a profile via the hidden web API (works without login). */
export async function scrapeProfilePosts(username: string, limit = 12): Promise<NormalizedPost[]> {
    const clean = String(username).replace(/^@/, '').trim();
    if (!clean) return [];
    // No cookie: web_profile_info 302-redirects for authed sessions, but works
    // fine logged-out.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await igGet(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}`, { useCookie: false });
    const user = data?.data?.user;
    const owner = user?.username || clean;
    const edges = user?.edge_owner_to_timeline_media?.edges || [];
    const out: NormalizedPost[] = [];
    for (const e of edges.slice(0, limit)) {
        const n = e.node;
        if (!n) continue;
        out.push(mediaToPost({
            pk: n.id,
            code: n.shortcode,
            caption: n.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            like_count: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count,
            comment_count: n.edge_media_to_comment?.count,
            image_versions2: { candidates: [{ url: n.display_url }] },
            video_versions: n.is_video && n.video_url ? [{ url: n.video_url }] : [],
            view_count: n.video_view_count,
            video_duration: n.video_duration,
            original_height: n.dimensions?.height,
            original_width: n.dimensions?.width,
            taken_at: n.taken_at_timestamp,
            user: { username: owner },
        }, 'profile', clean));
    }
    return out;
}

/** Discover posts across many hashtags + profiles in parallel. */
export async function discoverInstagramPosts(opts: { hashtags?: string[]; profiles?: string[]; limit?: number }): Promise<NormalizedPost[]> {
    const limit = opts.limit ?? 12;
    const settled = await Promise.allSettled([
        ...(opts.hashtags || []).map((t) => scrapeHashtagPosts(t, limit)),
        ...(opts.profiles || []).map((p) => scrapeProfilePosts(p, limit)),
    ]);
    return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

// Instagram shortcodes are the media id encoded in base64 (this alphabet).
// Decoding gives the numeric media pk without any network call.
const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function shortcodeToMediaId(code: string): string {
    // base64 -> big decimal via string arithmetic (media ids exceed Number's
    // safe range, and BigInt literals need an ES2020 target the repo doesn't use).
    const digits = [0]; // little-endian decimal digits
    for (const ch of code) {
        const val = SHORTCODE_ALPHABET.indexOf(ch);
        if (val === -1) return '';
        let carry = val;
        for (let i = 0; i < digits.length; i++) {
            const cur = digits[i] * 64 + carry;
            digits[i] = cur % 10;
            carry = Math.floor(cur / 10);
        }
        while (carry > 0) { digits.push(carry % 10); carry = Math.floor(carry / 10); }
    }
    return digits.reverse().join('') || '0';
}

/** Top comments for a single post. Needs IG_SESSIONID; returns authed=false
 *  (empty comments) when the cookie is missing/expired so callers fall back to
 *  caption-only sentiment. */
export async function scrapePostComments(urlOrCode: string, limit = 15): Promise<PostComments> {
    const code = extractShortcode(urlOrCode);
    const base: PostComments = {
        url: code ? `https://www.instagram.com/p/${code}/` : String(urlOrCode),
        shortcode: code,
        comments: [],
        concatenated_text: '',
        authed: false,
    };
    if (!code) return base;

    // Resolve the numeric media pk directly from the shortcode. Instagram killed
    // the old `?__a=1` permalink endpoint (now 404), so we decode the shortcode —
    // it's just the base64 of the media id — and hit the comments API straight.
    const pk = shortcodeToMediaId(code);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any[] = [];
    if (pk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c: any = await igGet(`https://www.instagram.com/api/v1/media/${pk}/comments/?can_support_threading=true&permalink_enabled=false`);
        raw = c?.comments || [];
    }

    const comments = raw.slice(0, limit).map((c) => ({
        text: asText(c.text) || String(c.text || ''),
        username: c.user?.username || '',
        likeCount: num(c.comment_like_count ?? c.like_count),
    })).filter((c) => c.text);

    return {
        url: base.url,
        shortcode: code,
        comments,
        concatenated_text: comments.map((c) => c.text).join('\n'),
        authed: comments.length > 0 || Boolean(process.env.IG_SESSIONID),
    };
}
