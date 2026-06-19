import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';

export const runtime = 'nodejs';

const STATUSES = ['new', 'verified', 'contacted', 'replied', 'won', 'dead'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? '');
    if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: `Invalid status. One of: ${STATUSES.join(', ')}` }, { status: 400 });
    }
    const lead = await prisma.lead.update({ where: { id }, data: { status } });
    return NextResponse.json({ lead });
}
