import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';

export const runtime = 'nodejs';

const SYSTEM = `You are a prompt engineer for AI image generation models (GPT-Image, Flux, Gemini).
Rewrite the user's rough idea into a single, vivid, production-ready image prompt.
Include subject, composition, lighting, mood, style, and camera/lens details where they help.
Keep it under 80 words. Output ONLY the rewritten prompt — no preamble, no quotes, no explanation.`;

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !isAdminEmail(session.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt } = await req.json().catch(() => ({}));
    if (!prompt || !String(prompt).trim()) {
        return NextResponse.json({ error: 'Write a rough idea first.' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
        const msg = await anthropic.messages.create({
            model: 'claude-opus-4-8',
            max_tokens: 1024,
            system: SYSTEM,
            messages: [{ role: 'user', content: String(prompt) }],
        });
        const refined = msg.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('')
            .trim();
        if (!refined) {
            return NextResponse.json({ error: 'No refined prompt was returned.' }, { status: 502 });
        }
        return NextResponse.json({ prompt: refined });
    } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        console.error('STUDIO_REFINE_ERROR:', e?.message);
        return NextResponse.json(
            { error: e?.message || 'Prompt refinement failed.' },
            { status: e?.status || 500 },
        );
    }
}
