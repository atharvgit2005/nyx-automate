import type { Prisma } from '@prisma/client';

/** Build a Prisma `where` from URL query params — shared by /api/leads + export. */
export function buildLeadWhere(sp: URLSearchParams): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    const status = sp.get('status');
    if (status) where.status = status;

    const source = sp.get('source');
    if (source) where.source = source;

    const queryId = sp.get('queryId');
    if (queryId) where.queryId = queryId;

    const temperature = sp.get('temperature');
    if (temperature) where.temperature = temperature;

    const minScore = Number(sp.get('minScore'));
    if (Number.isFinite(minScore) && minScore > 0) where.score = { gte: minScore };

    const hasEmail = sp.get('hasEmail');
    if (hasEmail === 'true') where.email = { not: null };
    else if (hasEmail === 'false') where.email = null;

    const q = sp.get('q')?.trim();
    if (q) {
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { website: { contains: q, mode: 'insensitive' } },
        ];
    }

    return where;
}
