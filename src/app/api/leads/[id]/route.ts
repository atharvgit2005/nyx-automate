import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';

export const runtime = 'nodejs';

const STATUSES = ['new', 'verified', 'contacted', 'replied', 'won', 'dead'];
const TEMPERATURES = ['hot', 'warm', 'cold'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: { status?: string; temperature?: string | null } = {};
    if ('status' in body) {
        if (!STATUSES.includes(String(body.status))) {
            return NextResponse.json({ error: `Invalid status. One of: ${STATUSES.join(', ')}` }, { status: 400 });
        }
        data.status = String(body.status);
    }
    if ('temperature' in body) {
        const t = body.temperature;
        if (t !== null && !TEMPERATURES.includes(String(t))) {
            return NextResponse.json({ error: `Invalid temperature. One of: ${TEMPERATURES.join(', ')} or null` }, { status: 400 });
        }
        data.temperature = t === null ? null : String(t);
    }
    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'Nothing to update (status or temperature).' }, { status: 400 });
    }

    const lead = await prisma.lead.update({ where: { id }, data });
    return NextResponse.json({ lead });
}
