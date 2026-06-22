import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { scoreLead } from '@/lib/leads/scoring';
import { mapWithConcurrency } from '@/lib/leads/util';
import type { RawLead } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Ingest endpoint for n8n (or any owned engine). n8n gathers/enriches leads in
// YOUR workflow, then POSTs them here; the app scores + upserts + updates the run.
// Auth: send header `x-engine-token: <ENGINE_TOKEN>` (matches the value the app
// sends to your n8n webhook). This is machine-to-machine, NOT a user session.

function authed(req: Request): boolean {
    const token = process.env.ENGINE_TOKEN;
    if (!token) return false; // must be configured to accept ingest
    return req.headers.get('x-engine-token') === token;
}

function clean(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t ? t : undefined;
}

export async function POST(req: Request) {
    if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const runId = clean(body.runId);
    const queryId = clean(body.queryId);
    const rawList: unknown[] = Array.isArray(body.leads) ? body.leads : [];
    if (rawList.length === 0) {
        // Nothing found this run — succeed cleanly (don't error the n8n workflow).
        if (runId) {
            await prisma.scrapeRun.update({
                where: { id: runId },
                data: { status: 'done', leadCount: 0, finishedAt: new Date() },
            }).catch(() => undefined);
        }
        return NextResponse.json({ ingested: 0 });
    }

    // Normalize + validate (need at least source, sourceId, name).
    const leads: RawLead[] = [];
    for (const r of rawList as Record<string, unknown>[]) {
        const source = clean(r.source);
        const sourceId = clean(r.sourceId);
        const name = clean(r.name);
        if (!source || !sourceId || !name) continue;
        leads.push({
            source, sourceId, name,
            website: clean(r.website),
            email: clean(r.email),
            phone: clean(r.phone),
            contactName: clean(r.contactName),
            contactTitle: clean(r.contactTitle),
            instagram: clean(r.instagram),
            category: clean(r.category),
            address: clean(r.address),
        });
    }
    if (leads.length === 0) {
        if (runId) {
            await prisma.scrapeRun.update({
                where: { id: runId },
                data: { status: 'done', leadCount: 0, finishedAt: new Date() },
            }).catch(() => undefined);
        }
        return NextResponse.json({ ingested: 0 });
    }

    await mapWithConcurrency(leads.slice(0, 500), 5, async (lead) => {
        const { score, signals } = scoreLead(lead);
        await prisma.lead.upsert({
            where: { source_sourceId: { source: lead.source, sourceId: lead.sourceId } },
            create: { ...lead, score, signals, queryId },
            update: {
                name: lead.name, website: lead.website, email: lead.email, phone: lead.phone,
                instagram: lead.instagram, contactName: lead.contactName, contactTitle: lead.contactTitle,
                category: lead.category, address: lead.address, score, signals,
            },
        });
    });

    // Mark the run done if a runId was passed.
    if (runId) {
        await prisma.scrapeRun.update({
            where: { id: runId },
            data: { status: 'done', leadCount: leads.length, finishedAt: new Date() },
        }).catch(() => undefined);
    }

    return NextResponse.json({ ingested: leads.length });
}
