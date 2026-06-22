import { generateText } from '@/lib/llm/text';
import { mineWinners } from '@/lib/insights/winners';

// Content factory (#4): turn a topic (optionally informed by what's working in a
// niche, via #3 winner mining) into a ready-to-post piece — caption, hooks,
// hashtags, and an image prompt. Reuses the free LLM + winner mining.

export interface ContentPiece {
    caption: string;
    hooks: string[];
    hashtags: string[];
    visualConcept: string;
    imagePrompt: string;
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

const SYSTEM = `You are a senior social content creator at NYX, a creative studio. Produce ONE ready-to-post Instagram piece for the given topic and brand voice. If proven niche patterns are provided, apply them. Return ONLY JSON, no markdown:
{
  "caption": "<full post caption, on-brand, with line breaks and 1-2 tasteful emojis, ending with a question or CTA>",
  "hooks": ["<3 alternative scroll-stopping first lines>"],
  "hashtags": ["<8-12 relevant hashtags, WITHOUT the # symbol>"],
  "visualConcept": "<one sentence describing the ideal visual>",
  "imagePrompt": "<a detailed, vivid image-generation prompt for that visual — describe subject, style, lighting, composition, mood; photographic and on-brand; no text overlays>"
}`;

export async function buildContent(opts: { topic: string; brand?: string; handles?: string[] }): Promise<{ piece: ContentPiece; patterns: string[] }> {
    let patterns: string[] = [];
    if (opts.handles?.length) {
        try {
            const w = await mineWinners(opts.handles, 8, 6);
            patterns = w.patterns;
        } catch {
            // inspiration is optional — proceed without it
        }
    }

    const prompt = `Topic: ${opts.topic}\nBrand voice: ${opts.brand || 'NYX — modern, bold, creative'}` +
        (patterns.length ? `\nProven patterns in this niche to apply:\n- ${patterns.join('\n- ')}` : '');

    const piece: ContentPiece = { caption: '', hooks: [], hashtags: [], visualConcept: '', imagePrompt: '' };
    const r = await generateText({ system: SYSTEM, prompt, maxTokens: 900 });
    piece.provider = r.provider;
    try {
        const j = JSON.parse(stripToJson(r.text));
        piece.caption = String(j.caption || '');
        piece.hooks = arr(j.hooks);
        piece.hashtags = arr(j.hashtags).map((h) => h.replace(/^#/, ''));
        piece.visualConcept = String(j.visualConcept || '');
        piece.imagePrompt = String(j.imagePrompt || opts.topic);
    } catch {
        piece.imagePrompt = opts.topic;
    }
    if (!piece.imagePrompt) piece.imagePrompt = opts.topic;
    return { piece, patterns };
}
