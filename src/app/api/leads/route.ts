import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';
import { buildLeadWhere } from '@/lib/leads/filters';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const where = buildLeadWhere(sp);
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));

    const [total, leads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
            where,
            orderBy: { score: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);

    return NextResponse.json({ leads, total, page, pageSize, pages: Math.ceil(total / pageSize) });
}
