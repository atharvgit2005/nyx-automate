import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';
import { parseCsv } from '@/lib/leads/sources';
import { scoreLead } from '@/lib/leads/scoring';
import { mapWithConcurrency } from '@/lib/leads/util';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_ROWS = 500; // keep within the Vercel request window

export async function POST(req: Request) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'A CSV file is required (field "file").' }, { status: 400 });
    }
    const queryIdRaw = form?.get('queryId');
    const queryId = typeof queryIdRaw === 'string' && queryIdRaw ? queryIdRaw : null;

    const raw = parseCsv(await file.text());
    if (raw.length === 0) {
        return NextResponse.json({ error: 'No valid rows (each row needs a "name").' }, { status: 400 });
    }
    const rows = raw.slice(0, MAX_ROWS);

    await mapWithConcurrency(rows, 5, async (lead) => {
        const { score, signals } = scoreLead(lead);
        await prisma.lead.upsert({
            where: { source_sourceId: { source: lead.source, sourceId: lead.sourceId } },
            create: { ...lead, score, signals, queryId: queryId ?? undefined },
            // keep existing status + emailValid on re-import
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

    return NextResponse.json({ imported: rows.length, parsed: raw.length, capped: raw.length > MAX_ROWS });
}
