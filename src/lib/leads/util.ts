// Small shared helpers for the lead pipeline.

/** Strip protocol + www + path → bare domain. Returns '' if not parseable. */
export function normalizeDomain(website: string | undefined | null): string {
    if (!website) return '';
    let w = website.trim().toLowerCase();
    if (!w) return '';
    if (!/^https?:\/\//.test(w)) w = `https://${w}`;
    try {
        const host = new URL(w).hostname.replace(/^www\./, '');
        return host;
    } catch {
        return '';
    }
}

/** URL/ID-safe slug from arbitrary text. */
export function slugify(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

/** Run an async mapper over items with a bounded number of workers. */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await mapper(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}
