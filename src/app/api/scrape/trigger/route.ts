import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';
import { getRunnableSources } from '@/lib/leads/sources';
import { scoreLead } from '@/lib/leads/scoring';
import { mapWithConcurrency } from '@/lib/leads/util';
import type { RawLead } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // keep the result cap low enough to finish in this window

const RESULT_CAP = 50;

export async function POST(req: Request) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const queryId = String(body.queryId ?? '');
    if (!queryId) return NextResponse.json({ error: 'queryId is required.' }, { status: 400 });

    const query = await prisma.scrapeQuery.findUnique({ where: { id: queryId } });
    if (!query) return NextResponse.json({ error: 'Query not found.' }, { status: 404 });

    // One run at a time per query.
    const active = await prisma.scrapeRun.findFirst({
        where: { queryId, status: { in: ['queued', 'running'] } },
    });
    if (active) return NextResponse.json({ error: 'A run is already in progress.' }, { status: 409 });

    // Scale-later hook: hand the job to n8n and return immediately.
    if (process.env.N8N_WEBHOOK_URL) {
        const run = await prisma.scrapeRun.create({ data: { queryId, status: 'queued' } });
        await fetch(process.env.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.ENGINE_TOKEN ? { 'x-engine-token': process.env.ENGINE_TOKEN } : {}),
            },
            body: JSON.stringify({
                runId: run.id,
                queryId,
                text: query.text,
                region: query.region,
                sources: query.sources,
                filters: query.filters,
            }),
        }).catch(() => undefined);
        return NextResponse.json({ run, mode: 'n8n' }, { status: 202 });
    }

    // Inline run.
    const run = await prisma.scrapeRun.create({
        data: { queryId, status: 'running', startedAt: new Date() },
    });
    try {
        const sources = getRunnableSources(query.sources);
        const collected: RawLead[] = [];
        for (const src of sources) {
            if (collected.length >= RESULT_CAP) break;
            const found = await src.search({
                text: query.text,
                region: query.region,
                filters: (query.filters as Record<string, unknown> | null) ?? null,
                limit: RESULT_CAP - collected.length,
            });
            collected.push(...found);
        }

        // Dedupe within this batch before upserting.
        const seen = new Set<string>();
        const unique = collected.filter((l) => {
            const k = `${l.source}:${l.sourceId}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        await mapWithConcurrency(unique, 5, async (lead) => {
            const { score, signals } = scoreLead(lead);
            await prisma.lead.upsert({
                where: { source_sourceId: { source: lead.source, sourceId: lead.sourceId } },
                create: { ...lead, score, signals, queryId: query.id },
                update: {
                    name: lead.name,
                    website: lead.website,
                    email: lead.email,
                    phone: lead.phone,
                    instagram: lead.instagram,
                    contactName: lead.contactName,
                    contactTitle: lead.contactTitle,
                    category: lead.category,
                    address: lead.address,
                    score,
                    signals,
                },
            });
        });

        const updated = await prisma.scrapeRun.update({
            where: { id: run.id },
            data: { status: 'done', leadCount: unique.length, finishedAt: new Date() },
        });
        return NextResponse.json({ run: updated, mode: 'inline' });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Scrape failed.';
        await prisma.scrapeRun.update({
            where: { id: run.id },
            data: { status: 'failed', error: msg, finishedAt: new Date() },
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
