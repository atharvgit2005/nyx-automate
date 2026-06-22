import { generateText } from '@/lib/llm/text';
import { resolveInstagram } from './prospect';
import type { RawLead } from './types';

// Prospect report (#2): a deeper "here's what's wrong + how we'd fix it" teaser
// to send a prospect for free and win the work. Reuses the IG resolver + free LLM.

export interface ProspectReport {
    business: string;
    category?: string;
    igHandle: string | null;
    igFollowers: string | null;
    igFound: boolean;
    snapshot: string;        // 1-2 sentence current-state summary
    problems: string[];      // 3-5 specific issues
    recommendations: string[]; // 3-5 concrete fixes
    contentIdeas: string[];  // 3-5 ready post ideas
    closing: string;         // soft pitch close from NYX
    provider?: string;
}

function stripToJson(s: string): string {
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : s;
    const a = body.indexOf('{'), b = body.lastIndexOf('}');
    return a >= 0 && b > a ? body.slice(a, b + 1) : body;
}
function arr(v: unknown): string[] {
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

const SYSTEM = `You are a senior social media strategist at NYX, a creative content studio. Produce a concise, specific audit/report for a business that NYX could send for free to win their social-media work. Be concrete and useful (not generic). Return ONLY JSON, no markdown:
{
  "snapshot": "<1-2 sentences on their current social presence>",
  "problems": ["<3 to 5 specific problems with their current Instagram/social presence>"],
  "recommendations": ["<3 to 5 concrete, actionable fixes — content pillars, cadence, visual style, hooks>"],
  "contentIdeas": ["<3 to 5 ready-to-shoot post/reel ideas tailored to this business>"],
  "closing": "<2-3 sentence warm close from NYX offering to help, with a soft CTA>"
}
If their Instagram couldn't be found, frame problems/recs around likely gaps and hedge (don't assert they have no account as fact).`;

export async function generateProspectReport(lead: Pick<RawLead, 'name' | 'category' | 'website' | 'instagram' | 'address'>): Promise<ProspectReport> {
    const ig = await resolveInstagram(lead);
    const igStatus = ig.found
        ? `On Instagram as @${ig.handle}: ${ig.followers} followers, ${ig.postCount} recent posts loaded. Bio: ${ig.bio || '(none)'}. Recent posts:\n${ig.recent || '(none)'}`
        : ig.handle
            ? `Handle @${ig.handle} found but profile couldn't be loaded (inactive/private).`
            : 'Could not locate their Instagram — they may not have one, or it isn\'t linked anywhere findable. Do not assert they have none.';

    const prompt = `Business: ${lead.name}\nCategory: ${lead.category || 'unknown'}\nLocation: ${lead.address || 'unknown'}\nWebsite: ${lead.website || 'none'}\nInstagram: ${igStatus}`;

    const base: ProspectReport = {
        business: lead.name, category: lead.category, igHandle: ig.handle, igFollowers: ig.followers, igFound: ig.found,
        snapshot: '', problems: [], recommendations: [], contentIdeas: [], closing: '',
    };
    try {
        const r = await generateText({ system: SYSTEM, prompt, maxTokens: 900 });
        base.provider = r.provider;
        const j = JSON.parse(stripToJson(r.text));
        base.snapshot = String(j.snapshot || '');
        base.problems = arr(j.problems);
        base.recommendations = arr(j.recommendations);
        base.contentIdeas = arr(j.contentIdeas);
        base.closing = String(j.closing || '');
    } catch {
        // return what we have (IG stats) even if the LLM/JSON failed
    }
    return base;
}
