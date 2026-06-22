import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import prisma from '@/lib/prismadb';
import { OpenStreetMapSource } from '@/lib/leads/sources/openStreetMap';
import { assessProspect } from '@/lib/leads/prospect';
import { mapWithConcurrency } from '@/lib/leads/util';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Client-finder: discover businesses for a query, assess each one's Instagram,
// draft an outreach pitch, and store as leads. Callable by an admin (UI) or by
// n8n / the engine via x-engine-token.
async function allowed(req: Request): Promise<boolean> {
    const token = process.env.ENGINE_TOKEN;
    if (token && req.headers.get('x-engine-token') === token) return true;
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}

export async function POST(req: Request) {
    if (!(await allowed(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const body = await req.json().catch(() => ({}));
        const query = String(body.query || '').trim();
        if (!query) return NextResponse.json({ error: 'query is required (e.g. "cafes in Mumbai")' }, { status: 400 });
        const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 15);
        const region = body.region ? String(body.region) : null;

        const businesses = await new OpenStreetMapSource().search({ text: query, region, limit, filters: null });
        if (businesses.length === 0) {
            return NextResponse.json({ count: 0, prospects: [], note: 'No businesses found for that query.' });
        }

        // Assess each (IG find + scrape + AI pitch), keep concurrency low — IG and
        // the LLM are both rate-sensitive.
        const prospects = await mapWithConcurrency(businesses, 3, async (b) => {
            const a = await assessProspect(b);
            const signals = [
                a.igFound ? `On Instagram (@${a.igHandle}, ${a.igFollowers} followers)` : (a.igHandle ? 'Instagram inactive/unreachable' : 'No Instagram — social gap'),
                a.weaknesses,
            ].filter(Boolean);
            await prisma.lead.upsert({
                where: { source_sourceId: { source: b.source, sourceId: b.sourceId } },
                create: {
                    source: b.source, sourceId: b.sourceId, name: b.name,
                    website: b.website, phone: b.phone, instagram: b.instagram, category: b.category, address: b.address,
                    score: a.opportunity, signals,
                    igHandle: a.igHandle, igFollowers: a.igFollowers, igPostCount: a.igPostCount,
                    opportunity: a.opportunity, weaknesses: a.weaknesses, pitch: a.pitch,
                },
                update: {
                    name: b.name, website: b.website, phone: b.phone, instagram: b.instagram,
                    category: b.category, address: b.address, score: a.opportunity, signals,
                    igHandle: a.igHandle, igFollowers: a.igFollowers, igPostCount: a.igPostCount,
                    opportunity: a.opportunity, weaknesses: a.weaknesses, pitch: a.pitch,
                },
            }).catch(() => undefined);
            return {
                name: b.name, website: b.website, category: b.category, address: b.address,
                igHandle: a.igHandle, igFollowers: a.igFollowers, igPostCount: a.igPostCount, igFound: a.igFound,
                opportunity: a.opportunity, weaknesses: a.weaknesses, pitch: a.pitch, provider: a.provider,
            };
        });

        prospects.sort((x, y) => y.opportunity - x.opportunity);
        return NextResponse.json({ count: prospects.length, prospects });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'prospecting failed' }, { status: 500 });
    }
}
