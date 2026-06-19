import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';

export const runtime = 'nodejs';

const VALID_SOURCES = ['csv', 'google_places'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: Prisma.ScrapeQueryUpdateInput = {};
    if (typeof body.text === 'string') data.text = body.text.trim();
    if ('region' in body) data.region = body.region ? String(body.region) : null;
    if (Array.isArray(body.sources)) {
        data.sources = body.sources.filter(
            (s: unknown): s is string => typeof s === 'string' && VALID_SOURCES.includes(s),
        );
    }
    if ('filters' in body) data.filters = body.filters as Prisma.InputJsonValue;
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;

    const query = await prisma.scrapeQuery.update({ where: { id }, data });
    return NextResponse.json({ query });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await prisma.scrapeQuery.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
