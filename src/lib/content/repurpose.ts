import { generateText } from '@/lib/llm/text';

// Repurpose engine (#5): take ONE idea (or an existing caption/post) and spin it
// into every format — feed caption, carousel slides, reel script, story, and a
// short X/thread version. One free-LLM call. Reuses the free LLM chain.

export interface ReelScript {
    hook: string;
    scenes: string[];
    cta: string;
}
export interface RepurposePack {
    caption: string;
    carousel: string[];
    reel: ReelScript;
    story: string;
    tweet: string;
    hashtags: string[];
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

const SYSTEM = `You are a senior social content creator at NYX, a creative studio. Take ONE source idea (a topic or an existing post) and repurpose it into every Instagram format, keeping a consistent message and the given brand voice. Return ONLY JSON, no markdown:
{
  "caption": "<full feed-post caption, on-brand, line breaks + 1-2 tasteful emojis, ends with a question/CTA>",
  "carousel": ["<slide 1 text — a strong hook>", "<slide 2>", "<slide 3>", "<slide 4>", "<slide 5 — CTA slide>"],
  "reel": {"hook": "<first 2 seconds spoken/on-screen hook>", "scenes": ["<scene/beat 1 with on-screen text>", "<beat 2>", "<beat 3>", "<beat 4>"], "cta": "<closing call to action>"},
  "story": "<a short story idea with text + an interactive element (poll/question sticker)>",
  "tweet": "<a punchy X/Twitter version, under 280 chars>",
  "hashtags": ["<8-12 relevant hashtags WITHOUT the # symbol>"]
}`;

export async function repurposeContent(opts: { source: string; brand?: string }): Promise<RepurposePack> {
    const prompt = `Source idea / post to repurpose:\n"""${opts.source}"""\nBrand voice: ${opts.brand || 'NYX — modern, bold, creative'}`;

    const pack: RepurposePack = { caption: '', carousel: [], reel: { hook: '', scenes: [], cta: '' }, story: '', tweet: '', hashtags: [] };
    const r = await generateText({ system: SYSTEM, prompt, maxTokens: 1300 });
    pack.provider = r.provider;
    try {
        const j = JSON.parse(stripToJson(r.text));
        pack.caption = String(j.caption || '');
        pack.carousel = arr(j.carousel);
        pack.reel = {
            hook: String(j.reel?.hook || ''),
            scenes: arr(j.reel?.scenes),
            cta: String(j.reel?.cta || ''),
        };
        pack.story = String(j.story || '');
        pack.tweet = String(j.tweet || '');
        pack.hashtags = arr(j.hashtags).map((h) => h.replace(/^#/, ''));
    } catch {
        // return whatever parsed; caller still gets provider
    }
    return pack;
}
