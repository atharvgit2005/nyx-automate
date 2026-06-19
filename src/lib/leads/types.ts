// Shared types for the lead pipeline.

export type RawLead = {
    source: string; // "csv" | "google_places"
    sourceId: string;
    name: string;
    website?: string;
    email?: string;
    phone?: string;
    contactName?: string;
    contactTitle?: string;
    instagram?: string;
    category?: string;
    address?: string;
};

export type SourceQuery = {
    text: string;
    region?: string | null;
    filters?: Record<string, unknown> | null;
    limit: number;
};

// A live, searchable source (e.g. Google Places). CSV import is handled
// separately by parseCsv() because it takes an uploaded file, not a query.
export interface LeadSource {
    readonly id: string;
    /** Returns [] (skips) when the source isn't configured (e.g. missing key). */
    search(query: SourceQuery): Promise<RawLead[]>;
}
