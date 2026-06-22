import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { mineWinners } from '@/lib/insights/winners';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Winner mining (#3): scan accounts, rank top posts, extract why they work.
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
        const handles: string[] = Array.isArray(body.handles)
            ? body.handles
            : String(body.handles || '').split(/[\s,]+/).filter(Boolean);
        if (!handles.length) return NextResponse.json({ error: 'handles required (e.g. ["nike","adidas"])' }, { status: 400 });
        const perAccount = Math.min(Math.max(Number(body.perAccount) || 12, 1), 24);
        const topN = Math.min(Math.max(Number(body.topN) || 8, 1), 20);
        const result = await mineWinners(handles, perAccount, topN);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'winner mining failed' }, { status: 500 });
    }
}
