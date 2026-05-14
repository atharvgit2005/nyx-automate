import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// Auth gating for the standalone NYX Automate app.
//   /admin_automate/*  → must be the ADMIN_EMAIL account
//   /dashboard/*       → must be logged in
//
// (Pre-split this also handled /portal/* and lived behind an /automate
// prefix — both are gone now that Automate is its own deployment.)
export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = await getToken({ req });

    // ── /admin_automate — must be admin ────────────────────────────
    if (pathname.startsWith('/admin_automate')) {
        if (!token) {
            const url = new URL('/login', req.url);
            url.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(url);
        }
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail || token.email !== adminEmail) {
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }
        return NextResponse.next();
    }

    // ── /dashboard — must be logged in ─────────────────────────────
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
    matcher: [
        '/dashboard/:path*',
        '/admin_automate/:path*',
    ],
};
