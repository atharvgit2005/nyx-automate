import type { LeadSource } from '../types';
import { GooglePlacesSource } from './googlePlaces';
import { OpenStreetMapSource } from './openStreetMap';
import { YelpSource } from './yelp';

export { parseCsv, CSV_TEMPLATE_HEADERS } from './csv';
export { GooglePlacesSource } from './googlePlaces';
export { OpenStreetMapSource } from './openStreetMap';
export { YelpSource } from './yelp';

// Live, searchable sources used by /api/scrape/trigger. CSV is import-driven
// (see parseCsv) and is intentionally NOT here.
// TODO: add ApolloSource and other paid sources as future LeadSource impls.
const REGISTRY: Record<string, () => LeadSource> = {
    google_places: () => new GooglePlacesSource(),
    openstreetmap: () => new OpenStreetMapSource(),
    yelp: () => new YelpSource(),
};

/** All selectable source ids (csv is import-only but valid on a query). */
export const SOURCE_IDS = ['csv', 'openstreetmap', 'google_places', 'yelp'] as const;

/** Resolve the runnable sources a query asked for (skips "csv" and unknowns). */
export function getRunnableSources(sourceIds: readonly string[]): LeadSource[] {
    return sourceIds
        .map((id) => REGISTRY[id])
        .filter((factory): factory is () => LeadSource => Boolean(factory))
        .map((factory) => factory());
}
