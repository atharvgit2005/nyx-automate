import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';

export const runtime = 'nodejs';
// Image generation can take a while; give the function headroom.
export const maxDuration = 120;

type ImageSize = '1024x1024' | '1536x1024' | '1024x1536';

const SIZE_BY_ASPECT: Record<string, ImageSize> = {
    '1:1': '1024x1024',
    '4:5': '1024x1536',
    '9:16': '1024x1536',
    '16:9': '1536x1024',
    '3:2': '1536x1024',
};

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !isAdminEmail(session.user?.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, aspect, model } = await req.json().catch(() => ({}));
    if (!prompt || !String(prompt).trim()) {
        return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
    }

    // Only OpenAI gpt-image-1 is live right now. Gemini/Flux are placeholders
    // until their API keys are wired up.
    if (model && model !== 'gpt-image-1') {
        return NextResponse.json(
            { error: `${model} isn't connected yet — only GPT-Image is live. Add its API key to enable it.` },
            { status: 400 },
        );
    }
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OPENAI_API_KEY is not set on the server.' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const size: ImageSize = SIZE_BY_ASPECT[aspect as string] ?? '1024x1024';

    try {
        const result = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: String(prompt),
            size,
            n: 1,
        });
        const b64 = result.data?.[0]?.b64_json;
        if (!b64) {
            return NextResponse.json({ error: 'No image was returned.' }, { status: 502 });
        }
        return NextResponse.json({ image: `data:image/png;base64,${b64}`, size });
    } catch (err: unknown) {
        const e = err as { message?: string; status?: number };
        console.error('STUDIO_GENERATE_ERROR:', e?.message);
        return NextResponse.json(
            { error: e?.message || 'Image generation failed.' },
            { status: e?.status || 500 },
        );
    }
}
