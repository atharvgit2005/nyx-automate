import type { LeadSource, RawLead, SourceQuery } from '../types';

// Yelp Fusion — free API key, no billing card. Strong in the US.
const ENDPOINT = 'https://api.yelp.com/v3/businesses/search';

type YelpBiz = {
    id: string;
    name: string;
    url: string; // Yelp listing page (Yelp doesn't expose the business's own site)
    phone?: string;
    display_phone?: string;
    location?: { display_address?: string[] };
    categories?: Array<{ title: string }>;
};

function pickLocation(query: SourceQuery): string {
    const m = query.text.match(/\bin\s+(.+)$/i);
    return (m ? m[1].trim() : query.region) ?? '';
}

export class YelpSource implements LeadSource {
    readonly id = 'yelp';

    async search(query: SourceQuery): Promise<RawLead[]> {
        const key = process.env.YELP_API_KEY;
        if (!key) return []; // not configured → skip

        const location = pickLocation(query);
        if (!location) return []; // Yelp requires a location

        const params = new URLSearchParams({
            term: query.text,
            location,
            limit: String(Math.min(50, query.limit)),
        });
        const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`Yelp ${res.status}`);
        const data = (await res.json()) as { businesses?: YelpBiz[] };

        return (data.businesses ?? []).slice(0, query.limit).map((b) => ({
            source: this.id,
            sourceId: b.id,
            name: b.name,
            website: b.url, // links to the Yelp page
            phone: b.phone || b.display_phone,
            address: b.location?.display_address?.join(', '),
            category: b.categories?.[0]?.title,
        }));
    }
}
