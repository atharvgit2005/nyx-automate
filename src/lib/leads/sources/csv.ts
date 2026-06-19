import { parse } from 'csv-parse/sync';
import type { RawLead } from '../types';
import { normalizeDomain, slugify } from '../util';

// Expected headers (case-insensitive). `name` is required.
const FIELDS = [
    'name',
    'website',
    'email',
    'phone',
    'instagram',
    'contactName',
    'contactTitle',
    'category',
    'address',
] as const;

type CsvRow = Record<string, string>;

function pick(row: CsvRow, key: string): string | undefined {
    const v = row[key.toLowerCase()];
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
}

/** Deterministic id so re-imports dedupe via @@unique([source, sourceId]). */
function csvSourceId(name: string, website?: string): string {
    const domain = normalizeDomain(website);
    return domain || slugify(name);
}

/**
 * Parse an uploaded CSV into normalized leads. Headers are matched
 * case-insensitively; rows without a name are skipped.
 */
export function parseCsv(content: string): RawLead[] {
    const records = parse(content, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
    }) as CsvRow[];

    const leads: RawLead[] = [];
    for (const row of records) {
        const name = pick(row, 'name');
        if (!name) continue;
        const website = pick(row, 'website');
        leads.push({
            source: 'csv',
            sourceId: csvSourceId(name, website),
            name,
            website,
            email: pick(row, 'email'),
            phone: pick(row, 'phone'),
            instagram: pick(row, 'instagram'),
            contactName: pick(row, 'contactName'),
            contactTitle: pick(row, 'contactTitle'),
            category: pick(row, 'category'),
            address: pick(row, 'address'),
        });
    }
    return leads;
}

export const CSV_TEMPLATE_HEADERS = FIELDS.join(',');
