import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';

export const runtime = 'nodejs';

const VALID_SOURCES = ['csv', 'google_places'];

export async function GET() {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const queries = await prisma.scrapeQuery.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { leads: true, runs: true } } },
    });
    return NextResponse.json({ queries });
}

export async function POST(req: Request) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Query text is required.' }, { status: 400 });

    const sources: string[] = Array.isArray(body.sources)
        ? body.sources.filter((s: unknown): s is string => typeof s === 'string' && VALID_SOURCES.includes(s))
        : [];

    const query = await prisma.scrapeQuery.create({
        data: {
            text,
            region: body.region ? String(body.region) : null,
            sources,
            filters: body.filters ?? undefined,
            enabled: body.enabled !== false,
        },
    });
    return NextResponse.json({ query }, { status: 201 });
}
