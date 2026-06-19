import type { LeadSource, RawLead, SourceQuery } from '../types';

// Google Places API v1 — Text Search.
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.formattedAddress',
    'places.primaryTypeDisplayName',
    'nextPageToken',
].join(',');

type PlacesResponse = {
    places?: Array<{
        id: string;
        displayName?: { text?: string };
        websiteUri?: string;
        nationalPhoneNumber?: string;
        formattedAddress?: string;
        primaryTypeDisplayName?: { text?: string };
    }>;
    nextPageToken?: string;
};

export class GooglePlacesSource implements LeadSource {
    readonly id = 'google_places';

    async search(query: SourceQuery): Promise<RawLead[]> {
        const key = process.env.GOOGLE_PLACES_KEY;
        if (!key) return []; // not configured → skip, don't error

        const leads: RawLead[] = [];
        let pageToken: string | undefined;
        let pages = 0;

        while (leads.length < query.limit && pages < 3) {
            const body: Record<string, unknown> = {
                textQuery: query.text,
                maxResultCount: Math.min(20, query.limit - leads.length),
            };
            if (query.region) body.regionCode = query.region;
            if (pageToken) body.pageToken = pageToken;

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': FIELD_MASK,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(20_000),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Google Places ${res.status}: ${text.slice(0, 200)}`);
            }
            const data = (await res.json()) as PlacesResponse;
            for (const p of data.places ?? []) {
                const name = p.displayName?.text;
                if (!name) continue;
                leads.push({
                    source: this.id,
                    sourceId: p.id,
                    name,
                    website: p.websiteUri,
                    phone: p.nationalPhoneNumber,
                    address: p.formattedAddress,
                    category: p.primaryTypeDisplayName?.text,
                });
            }
            pages += 1;
            if (!data.nextPageToken) break;
            pageToken = data.nextPageToken;
        }

        return leads.slice(0, query.limit);
        // TODO: enrich website → email / Instagram using src/lib/services helpers.
    }
}
