import { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { isAdminEmail } from "@/lib/config/admins"

/**
 * NYX Automate — internal admin tool auth.
 *
 * Database-FREE on purpose. The old Supabase DB + Prisma adapter were
 * decoupled during the Image-Studio pivot; sign-in must work before a new
 * database is wired up. So sessions are pure JWT (no adapter, no user/account
 * persistence) and access is gated by the admin allowlist in
 * `src/lib/config/admins.ts` (Atharv + Bhavya + the NYX shared account).
 *
 * When a new DB is added later: re-introduce `PrismaAdapter`, restore the
 * Account/Session persistence and (optionally) the credentials provider.
 */

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role?: string | null;
        }
    }
    interface User {
        id: string;
        role?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role?: string | null;
    }
}

export const authOptions: AuthOptions = {
    debug: process.env.NODE_ENV !== "production",
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60,   // refresh-rotate daily
    },
    jwt: {
        maxAge: 30 * 24 * 60 * 60,
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            allowDangerousEmailAccountLinking: true,
            // Always show the account chooser so users can switch Google accounts.
            authorization: { params: { prompt: "select_account" } },
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login",
    },
    /*
    cookies:
        process.env.NODE_ENV === "production"
            ? {
                sessionToken: {
                    name: "__Secure-automate.session-token",
                    options: {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                        secure: true,
                        maxAge: 30 * 24 * 60 * 60,
                    },
                },
            }
            : undefined,
    */
    callbacks: {
        // Allowlist gate: only verified Google emails on the admin list get in.
        async signIn({ user, account, profile }) {
            if (account?.provider !== "google") return false;

            const email = (
                (profile as { email?: string } | undefined)?.email ??
                user.email ??
                ""
            ).trim().toLowerCase();
            const verified =
                (profile as { email_verified?: boolean } | undefined)?.email_verified ?? true;

            if (!email || !verified) return false;
            if (!isAdminEmail(email)) {
                // Routed to /login?error=AccessDenied
                return "/login?error=AccessDenied";
            }
            return true;
        },
        async jwt({ token }) {
            const email = (token.email ?? "").toLowerCase();
            token.role = email && isAdminEmail(email) ? "admin" : "user";
            if (!token.id) token.id = (token.sub as string) || email || "";
            return token;
        },
        async session({ session, token }) {
            if (session?.user) {
                session.user.id = token.id as string;
                session.user.role = token.role;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "dev-only-insecure-secret-change-me",
}
