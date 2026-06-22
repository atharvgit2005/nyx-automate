import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import {
    scrapeInstagramProfile,
    discoverInstagramPosts,
    scrapePostComments,
} from '@/lib/services/instagram-scraper';

export const runtime = 'nodejs';

// Allowed callers: a logged-in admin (the Brand Analysis UI) OR your n8n /
// engine, which sends the shared ENGINE_TOKEN. (Previously this route was open.)
async function allowed(req: Request): Promise<boolean> {
    const token = process.env.ENGINE_TOKEN;
    if (token && req.headers.get('x-engine-token') === token) return true;
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}

// Actions:
//   (default / "profile")  { username }                 -> single profile + recent posts (existing)
//   "discover"             { hashtags?, profiles?, limit } -> normalized posts for the IG workflow
//   "comments"             { url, limit }               -> top comments for one post
export async function POST(request: Request) {
    if (!(await allowed(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const body = await request.json();
        const action: string = body.action || (body.username ? 'profile' : '');
        const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 50);

        if (action === 'discover') {
            const posts = await discoverInstagramPosts({
                hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
                profiles: Array.isArray(body.profiles) ? body.profiles : [],
                limit,
            });
            return NextResponse.json({
                success: true,
                count: posts.length,
                hasSession: Boolean(process.env.IG_SESSIONID),
                posts,
            });
        }

        if (action === 'comments') {
            if (!body.url) {
                return NextResponse.json({ error: 'url is required' }, { status: 400 });
            }
            const data = await scrapePostComments(String(body.url), Math.min(Math.max(Number(body.limit) || 15, 1), 50));
            return NextResponse.json({ success: true, ...data });
        }

        // Default: existing single-profile behavior.
        if (!body.username) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }
        const profile = await scrapeInstagramProfile(String(body.username).replace('@', '').trim());
        return NextResponse.json({ success: true, data: profile });
    } catch {
        return NextResponse.json({ error: 'Failed to scrape' }, { status: 500 });
    }
}
