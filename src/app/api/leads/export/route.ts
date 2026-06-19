import prisma from '@/lib/prismadb';
import type { Lead } from '@prisma/client';
import { isAdminRequest } from '@/lib/leads/guard';
import { buildLeadWhere } from '@/lib/leads/filters';

export const runtime = 'nodejs';

const COLUMNS: Array<keyof Lead> = [
    'name', 'website', 'email', 'phone', 'contactName', 'contactTitle',
    'instagram', 'category', 'address', 'score', 'status', 'emailValid', 'source',
];

function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
    if (!(await isAdminRequest())) return new Response('Unauthorized', { status: 401 });

    const where = buildLeadWhere(new URL(req.url).searchParams);
    const encoder = new TextEncoder();
    const PAGE = 500;

    // Stream in pages so the full table never sits in memory.
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            controller.enqueue(encoder.encode(COLUMNS.join(',') + '\n'));
            let skip = 0;
            for (;;) {
                const batch = await prisma.lead.findMany({
                    where,
                    orderBy: { score: 'desc' },
                    skip,
                    take: PAGE,
                });
                if (batch.length === 0) break;
                for (const lead of batch) {
                    const row = COLUMNS.map((c) => csvCell(lead[c])).join(',');
                    controller.enqueue(encoder.encode(row + '\n'));
                }
                skip += batch.length;
                if (batch.length < PAGE) break;
            }
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="leads.csv"',
        },
    });
}
