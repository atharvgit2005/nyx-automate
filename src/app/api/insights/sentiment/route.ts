import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { generateText } from '@/lib/llm/text';

export const runtime = 'nodejs';

// Free sentiment for the Instagram workflow — reuses the free-first text chain
// (Groq → Gemini → OpenAI). Replaces the paid OpenAI node in the Apify version.
async function allowed(req: Request): Promise<boolean> {
    const token = process.env.ENGINE_TOKEN;
    if (token && req.headers.get('x-engine-token') === token) return true;
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}

const SYSTEM = `You are an audience-intelligence analyst. You read the comments (or, if there are none, the caption) of one Instagram post and return ONLY a JSON object — no prose, no markdown fences — with exactly these keys:
{"overall_sentiment": <integer 1-5>, "tool_usefulness": <integer 1-5>, "common_questions": [<distinct questions asked by commenters>], "key_insights": "<one short paragraph>"}`;

function stripToJson(s: string): string {
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : s;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export async function POST(request: Request) {
    if (!(await allowed(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const body = await request.json();
        const comments: string = Array.isArray(body.comments) ? body.comments.join('\n') : String(body.comments || '');
        const caption: string = String(body.caption || '');
        const corpus = comments.trim() || `(no comments — analyze the caption only)\nCaption: ${caption}`;

        const prompt = `Here are the aggregated comments for a single Instagram post:\n${corpus}\n\nCaption for context: ${caption}`;
        const { text, provider } = await generateText({ system: SYSTEM, prompt, maxTokens: 600 });

        let parsed: Record<string, unknown> = {};
        try {
            parsed = JSON.parse(stripToJson(text));
        } catch {
            parsed = {};
        }

        return NextResponse.json({
            success: true,
            provider,
            overall_sentiment: parsed.overall_sentiment ?? null,
            tool_usefulness: parsed.tool_usefulness ?? null,
            common_questions: Array.isArray(parsed.common_questions) ? parsed.common_questions : [],
            key_insights: parsed.key_insights ?? '',
        });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'sentiment failed' }, { status: 500 });
    }
}
