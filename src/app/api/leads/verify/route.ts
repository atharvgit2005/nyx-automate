import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { isAdminRequest } from '@/lib/leads/guard';
import { getVerifier } from '@/lib/leads/emailVerify';
import { mapWithConcurrency } from '@/lib/leads/util';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_PER_CALL = 200;

export async function POST(req: Request) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const leadIds: string[] = Array.isArray(body.leadIds)
        ? body.leadIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, MAX_PER_CALL)
        : [];
    if (leadIds.length === 0) {
        return NextResponse.json({ error: 'leadIds is required (max 200).' }, { status: 400 });
    }

    const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } } });
    const verifier = getVerifier();

    const results = await mapWithConcurrency(leads, 5, async (lead) => {
        let valid: boolean;
        let reason: string;
        if (!lead.email) {
            valid = false;
            reason = 'no_email';
        } else {
            const r = await verifier.verify(lead.email);
            valid = r.valid;
            reason = r.reason;
        }
        // Only promote/kill leads still in "new"; don't downgrade contacted/won/etc.
        const status = lead.status === 'new' ? (valid ? 'verified' : 'dead') : lead.status;
        await prisma.lead.update({ where: { id: lead.id }, data: { emailValid: valid, status } });
        return { id: lead.id, email: lead.email, valid, reason, status };
    });

    return NextResponse.json({ results });
}
