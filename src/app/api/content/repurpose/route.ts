import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { repurposeContent } from '@/lib/content/repurpose';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Repurpose engine (#5): one idea -> every format.
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
        const source = String(body.source || '').trim();
        if (!source) return NextResponse.json({ error: 'source is required (a topic or an existing post)' }, { status: 400 });
        const pack = await repurposeContent({ source, brand: body.brand });
        return NextResponse.json({ pack });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'repurpose failed' }, { status: 500 });
    }
}
