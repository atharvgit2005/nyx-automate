import { NextResponse } from 'next/server';
import { generateText } from '@/lib/llm/text';
import { isAdminRequest } from '@/lib/leads/guard';

export const runtime = 'nodejs';

const SYSTEM = `You are an expert social-media and advertising copywriter for a creative studio (NYX).
Write scroll-stopping, on-brand copy that sounds human, not generic AI.
Match the platform: Instagram = punchy hook + light emojis; LinkedIn = professional, no fluff;
X = short and sharp; Facebook/Ad = persuasive with a clear call to action; Hashtags = relevant, mixable sets.
Output ONLY a JSON array of strings (the options). No preamble, no markdown, no keys — just the array.`;

const TYPES = ['Caption', 'Ad copy', 'Hook', 'Hashtags'];

export async function POST(req: Request) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic ?? '').trim();
    if (!topic) return NextResponse.json({ error: 'Tell me what to promote.' }, { status: 400 });

    const platform = String(body.platform ?? 'Instagram');
    const tone = String(body.tone ?? 'Bold');
    const type = TYPES.includes(String(body.type)) ? String(body.type) : 'Caption';

    const userPrompt = `Promote: ${topic}
Platform: ${platform}
Tone: ${tone}
Type: ${type}
Give 5 distinct options.`;

    try {
        const { text } = await generateText({ system: SYSTEM, prompt: userPrompt, maxTokens: 1500 });
        const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

        let options: string[] = [];
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) options = parsed.map((x) => String(x)).filter(Boolean);
        } catch {
            options = cleaned
                .split('\n')
                .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
                .filter(Boolean);
        }
        if (options.length === 0) return NextResponse.json({ error: 'No copy was generated.' }, { status: 502 });
        return NextResponse.json({ options });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Copy generation failed.';
        const friendly = msg.startsWith('RATE_LIMITED') ? 'Gemini is rate-limited — wait a moment and try again.' : msg;
        console.error('COPY_GENERATE_ERROR:', msg);
        return NextResponse.json({ error: friendly }, { status: 500 });
    }
}
