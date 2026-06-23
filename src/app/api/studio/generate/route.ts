import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { generateImageWithChatGPT } from '@/lib/studio/chatgpt-image-generator';

export const runtime = 'nodejs';
// Image generation can take a while; give the function headroom.
export const maxDuration = 120;

type OpenAISize = '1024x1024' | '1536x1024' | '1024x1536';

const OPENAI_SIZE: Record<string, OpenAISize> = {
    '1:1': '1024x1024',
    '4:5': '1024x1536',
    '9:16': '1024x1536',
    '16:9': '1536x1024',
    '3:2': '1536x1024',
};

// width x height per aspect for pixel-based providers (Flux/Pollinations)
const DIMS: Record<string, [number, number]> = {
    '1:1': [1024, 1024],
    '4:5': [896, 1152],
    '3:2': [1216, 832],
    '16:9': [1280, 720],
    '9:16': [720, 1280],
};

function bad(error: string, status = 400) {
    return NextResponse.json({ error }, { status });
}

// ── Flux via Pollinations.ai — free, no API key ──────────────────────────
async function generateFlux(prompt: string, aspect: string) {
    const [w, h] = DIMS[aspect] ?? [1024, 1024];
    const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${w}&height=${h}&model=flux&nologo=true&private=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(110_000) });
    if (!res.ok) throw new Error(`Free Flux service returned ${res.status}. Try again.`);
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

// ── OpenAI gpt-image-1 (automated via ChatGPT cookie) ────────────────────
async function generateOpenAI(prompt: string, aspect: string) {
    return generateImageWithChatGPT(prompt, aspect);
}

// ── Gemini "Nano Banana" (free tier) via REST ────────────────────────────
async function generateGemini(prompt: string) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set — add a free key from Google AI Studio.');
    }
    // Model id is overridable in case Google renames it.
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
        }),
        signal: AbortSignal.timeout(110_000),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Gemini returned ${res.status}.`);
    }
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data);
    if (!img) throw new Error('Gemini did not return an image.');
    const mime = img.inlineData.mimeType || 'image/png';
    return `data:${mime};base64,${img.inlineData.data}`;
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !isAdminEmail(session.user?.email)) {
        return bad('Unauthorized', 401);
    }

    const { prompt, aspect = '1:1', model = 'flux-free' } = await req.json().catch(() => ({}));
    if (!prompt || !String(prompt).trim()) return bad('A prompt is required.');

    try {
        let image: string;
        if (model === 'flux-free') {
            image = await generateFlux(String(prompt), String(aspect));
        } else if (model === 'gpt-image-1') {
            image = await generateOpenAI(String(prompt), String(aspect));
        } else if (model === 'gemini-image') {
            image = await generateGemini(String(prompt));
        } else {
            return bad(`Unknown model "${model}".`);
        }
        return NextResponse.json({ image });
    } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        console.error('STUDIO_GENERATE_ERROR:', model, e?.message);
        return bad(e?.message || 'Image generation failed.', e?.status || 500);
    }
}
