import type { RawLead } from './types';

// Transparent, readable lead scoring. Every point is explained in `signals`
// so the portal can show the pitch rationale — no black box.

const SENIOR_TITLES = ['founder', 'owner', 'ceo', 'cmo', 'director', 'head', 'president', 'partner'];

export function scoreLead(lead: RawLead): { score: number; signals: string[] } {
    let score = 0;
    const signals: string[] = [];

    if (lead.email) {
        score += 30;
        signals.push('Has a contact email — reachable directly');
    }

    if (lead.website) {
        score += 15;
        signals.push('Has a website — established business');
    }

    // No Instagram is a *social gap* — an opportunity to pitch content/social work.
    if (lead.instagram) {
        score += 10;
        signals.push('Active on Instagram');
    } else {
        score += 15;
        signals.push('No Instagram found — clear social-media gap to pitch');
    }

    if (lead.phone) {
        score += 5;
        signals.push('Phone number available');
    }

    const title = lead.contactTitle?.toLowerCase() ?? '';
    if (title && SENIOR_TITLES.some((t) => title.includes(t))) {
        score += 25;
        signals.push(`Senior decision-maker contact (${lead.contactTitle})`);
    } else if (lead.contactName) {
        score += 10;
        signals.push('Named contact available');
    }

    return { score, signals };
}
