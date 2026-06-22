import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { generateProspectReport } from '@/lib/leads/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Prospect report (#2): generate a free audit/teaser for one business.
// Callable by an admin (UI) or by n8n / the engine via x-engine-token.
async function allowed(req: Request): Promise<boolean> {
    const token = process.env.ENGINE_TOKEN;
    if (token && req.headers.get('x-engine-token') === token) return true;
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}

export async function POST(req: Request) {
    if (!(await allowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name || '').trim();
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
        const report = await generateProspectReport({
            name,
            category: body.category,
            website: body.website,
            instagram: body.instagram,
            address: body.address,
        });
        return NextResponse.json({ report });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'report failed' }, { status: 500 });
    }
}
