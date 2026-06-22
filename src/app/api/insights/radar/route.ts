import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { scanRadar } from '@/lib/insights/radar';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Trend radar (#7): flag posts spiking above their account's normal.
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
        const perAccount = Math.min(Math.max(Number(body.perAccount) || 12, 4), 24);
        const threshold = Math.min(Math.max(Number(body.threshold) || 1.6, 1.1), 5);
        const sinceDays = Math.min(Math.max(Number(body.sinceDays) || 30, 3), 120);
        const result = await scanRadar(handles, perAccount, threshold, sinceDays);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'radar failed' }, { status: 500 });
    }
}
