import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';
import { buildContent } from '@/lib/content/factory';

export const runtime = 'nodejs';
export const maxDuration = 120;

const DIMS: Record<string, [number, number]> = {
    '1:1': [1024, 1024], '4:5': [896, 1152], '9:16': [720, 1280], '16:9': [1280, 720],
};

// Free image via Pollinations Flux (no key) — same provider as Image Studio.
async function generateFlux(prompt: string, aspect: string): Promise<string | null> {
    try {
        const [w, h] = DIMS[aspect] ?? [1024, 1024];
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=flux&nologo=true&private=true`;
        const res = await fetch(url, { signal: AbortSignal.timeout(110_000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

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
        const topic = String(body.topic || '').trim();
        if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });
        const brand = body.brand ? String(body.brand) : undefined;
        const aspect = ['1:1', '4:5', '9:16', '16:9'].includes(body.aspect) ? body.aspect : '4:5';
        const handles: string[] = Array.isArray(body.handles)
            ? body.handles
            : String(body.handles || '').split(/[\s,]+/).filter(Boolean);
        const withImage = body.withImage !== false;

        const { piece, patterns } = await buildContent({ topic, brand, handles });
        const image = withImage ? await generateFlux(piece.imagePrompt, aspect) : null;

        return NextResponse.json({ piece, patterns, image, aspect });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'content generation failed' }, { status: 500 });
    }
}
