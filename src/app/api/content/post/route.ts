import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';

export const runtime = 'nodejs';
export const maxDuration = 60;

// In-house posting via the private API (no Meta) — talks to the local
// aiograpi-rest container. ⚠️ Posting via the private API risks the account
// being banned; use a BURNER account's cookie (IG_POST_SESSIONID), never your
// main brand account. The official Graph API path (n8n nyx-ig-publisher) is the
// safe route for the real account.
async function allowed(req: Request): Promise<boolean> {
    const token = process.env.ENGINE_TOKEN;
    if (token && req.headers.get('x-engine-token') === token) return true;
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}

const AIO = process.env.AIOGRAPI_URL || 'http://localhost:8000';

export async function POST(req: Request) {
    if (!(await allowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sid = process.env.IG_POST_SESSIONID || process.env.IG_SESSIONID;
    if (!sid) return NextResponse.json({ error: 'Set IG_POST_SESSIONID (a burner account cookie) to post.' }, { status: 400 });

    try {
        const body = await req.json().catch(() => ({}));
        const imageUrl = String(body.imageUrl || '').trim();
        const caption = String(body.caption || '');
        if (!imageUrl) return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });

        // 1) log the burner session into aiograpi-rest
        const login = await fetch(`${AIO}/auth/login/by/sessionid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ sessionid: sid }),
            signal: AbortSignal.timeout(30000),
        });
        if (!login.ok) return NextResponse.json({ error: `aiograpi login failed (${login.status})`, detail: (await login.text()).slice(0, 300) }, { status: 502 });
        const session = (await login.text()).replace(/^"|"$/g, '');

        // 2) fetch the image bytes
        const img = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (!img.ok) return NextResponse.json({ error: `couldn't fetch image (${img.status})` }, { status: 400 });
        const buf = Buffer.from(await img.arrayBuffer());

        // 3) upload as a feed photo
        const fd = new FormData();
        fd.append('file', new Blob([buf], { type: img.headers.get('content-type') || 'image/jpeg' }), 'post.jpg');
        fd.append('caption', caption);
        const up = await fetch(`${AIO}/photo/upload`, {
            method: 'POST',
            headers: { 'X-Session-ID': session },
            body: fd,
            signal: AbortSignal.timeout(45000),
        });
        const text = await up.text();
        if (!up.ok) return NextResponse.json({ error: `upload failed (${up.status})`, detail: text.slice(0, 400) }, { status: 502 });

        let result: unknown = text;
        try { result = JSON.parse(text); } catch { /* keep text */ }
        return NextResponse.json({ posted: true, result });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'post failed' }, { status: 500 });
    }
}
