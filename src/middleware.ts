import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// Auth gating for the internal NYX Automate tool.
//   /dashboard/*  → must be logged in (Google + admin allowlist; see src/lib/auth.ts)
export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = await getToken({ req });

    if (pathname.startsWith('/dashboard')) {
        if (!token) {
            const url = new URL('/login', req.url);
            url.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*'],
};
