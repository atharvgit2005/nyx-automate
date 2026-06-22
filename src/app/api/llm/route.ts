import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { generateText } from '@/lib/llm/text';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Generic free-LLM endpoint — a drop-in "AI" step for n8n (or anything).
// Uses the free-first chain: Groq → Gemini → OpenAI. Body: { prompt, system?, maxTokens? }.
async function allowed(req: Request): Promise<boolean> {
    const token = process.env.ENGINE_TOKEN;
    if (token && req.headers.get('x-engine-token') === token) return true;
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}

export async function POST(req: Request) {
    if (!(await allowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const body = await req.json().catch(() => ({}));
        const prompt = String(body.prompt || '').trim();
        if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        const system = body.system ? String(body.system) : undefined;
        const maxTokens = Number(body.maxTokens) || 1000;
        const { text, provider } = await generateText({ system, prompt, maxTokens });
        return NextResponse.json({ text, provider });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'llm failed' }, { status: 500 });
    }
}
