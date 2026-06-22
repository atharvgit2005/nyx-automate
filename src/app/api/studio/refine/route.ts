import { NextResponse } from 'next/server';
import { generateText } from '@/lib/llm/text';
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
    try {
        const { text: refined } = await generateText({
            system: SYSTEM,
            prompt: `Rough idea: ${String(prompt)}`,
            maxTokens: 400,
        });
        if (!refined) return NextResponse.json({ error: 'No refined prompt was returned.' }, { status: 502 });
        return NextResponse.json({ prompt: refined });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Prompt refinement failed.';
        const friendly = msg.startsWith('RATE_LIMITED') ? 'Gemini is rate-limited — wait a moment and try again.' : msg;
        console.error('STUDIO_REFINE_ERROR:', msg);
        return NextResponse.json({ error: friendly }, { status: 500 });
    }
}
