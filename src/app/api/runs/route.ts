import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';

export const runtime = 'nodejs';

export async function GET() {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const runs = await prisma.scrapeRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { query: { select: { text: true } } },
    });
    return NextResponse.json({ runs });
}
