import type { LeadSource, RawLead, SourceQuery } from '../types';

// OpenStreetMap — free, no key, no billing. Geocode the area with Nominatim,
// then pull matching businesses from Overpass.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'nyx-automate-leads/1.0 (contact: team@nyxstudio.tech)';

// Map common business words → OSM tags.
const TAG_MAP: Array<{ match: RegExp; tags: string[] }> = [
    { match: /dentist|dental/i, tags: ['amenity=dentist'] },
    { match: /cafe|coffee/i, tags: ['amenity=cafe'] },
    { match: /restaurant|dining|eatery/i, tags: ['amenity=restaurant'] },
    { match: /gym|fitness/i, tags: ['leisure=fitness_centre'] },
    { match: /salon|hairdress|barber|beauty/i, tags: ['shop=hairdresser', 'shop=beauty'] },
    { match: /hotel|hostel/i, tags: ['tourism=hotel', 'tourism=hostel'] },
    { match: /clinic|hospital|doctor/i, tags: ['amenity=clinic', 'amenity=hospital', 'amenity=doctors'] },
    { match: /bakery/i, tags: ['shop=bakery'] },
    { match: /\bbar\b|pub/i, tags: ['amenity=bar', 'amenity=pub'] },
    { match: /lawyer|attorney|legal/i, tags: ['office=lawyer'] },
    { match: /real ?estate|realtor/i, tags: ['office=estate_agent'] },
    { match: /shop|store|retail|boutique/i, tags: ['shop'] },
];

type OverpassEl = {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
};

function pickTags(text: string): string[] {
    for (const { match, tags } of TAG_MAP) if (match.test(text)) return tags;
    return []; // fall back to name search
}

/** Location is the part after "in ", else the region code. */
function pickLocation(query: SourceQuery): string {
    const m = query.text.match(/\bin\s+(.+)$/i);
    if (m) return m[1].trim();
    return query.region ?? '';
}

function buildAddress(t: Record<string, string>): string | undefined {
    const parts = [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
}

export class OpenStreetMapSource implements LeadSource {
    readonly id = 'openstreetmap';

    async search(query: SourceQuery): Promise<RawLead[]> {
        const location = pickLocation(query);
        if (!location) return []; // need a place to bound the search

        // 1. Geocode the area → bounding box.
        const geoUrl = `${NOMINATIM}?q=${encodeURIComponent(location)}&format=json&limit=1` +
            (query.region ? `&countrycodes=${query.region.toLowerCase()}` : '');
        const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
        if (!geoRes.ok) throw new Error(`Nominatim ${geoRes.status}`);
        const geo = (await geoRes.json()) as Array<{ boundingbox?: [string, string, string, string] }>;
        const bbox = geo[0]?.boundingbox;
        if (!bbox) return [];
        const [s, n, w, e] = bbox; // Nominatim order: south, north, west, east
        const area = `${s},${w},${n},${e}`;

        // 2. Build the Overpass query.
        const tags = pickTags(query.text);
        const keyword = query.text.replace(/\bin\s+.+$/i, '').trim();
        const selectors = tags.length
            ? tags.flatMap((t) => {
                const sel = t.includes('=') ? `[${t.split('=')[0]}=${t.split('=')[1]}]` : `[${t}]`;
                return [`node${sel}(${area});`, `way${sel}(${area});`];
            })
            : [`node["name"~"${keyword}",i](${area});`, `way["name"~"${keyword}",i](${area});`];
        const ql = `[out:json][timeout:25];(${selectors.join('')});out center ${query.limit};`;

        const res = await fetch(OVERPASS, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', 'User-Agent': UA },
            body: ql,
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const data = (await res.json()) as { elements?: OverpassEl[] };

        const leads: RawLead[] = [];
        for (const el of data.elements ?? []) {
            const t = el.tags ?? {};
            if (!t.name) continue;
            leads.push({
                source: this.id,
                sourceId: `${el.type}/${el.id}`,
                name: t.name,
                website: t.website || t['contact:website'],
                phone: t.phone || t['contact:phone'],
                instagram: t['contact:instagram'],
                address: buildAddress(t),
                category: t.amenity || t.shop || t.office || t.tourism || t.leisure,
            });
            if (leads.length >= query.limit) break;
        }
        return leads;
    }
}
