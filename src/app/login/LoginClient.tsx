'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';

const ERROR_MESSAGES: Record<string, string> = {
    AccessDenied: 'That account is not on the NYX team allowlist. Use your @nyxstudio.tech account.',
    OAuthSignin: 'Sign-in failed. Check that your Google account is valid.',
    OAuthCallback: 'Google denied access or the network failed.',
    Callback: 'Error during the authentication callback.',
    default: 'Unable to sign in. Please try again.',
};

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(false);

    const rawCallback = searchParams.get('callbackUrl');
    const callbackUrl = rawCallback && rawCallback.startsWith('/') ? rawCallback : '/dashboard';

    const errorParam = searchParams.get('error');
    const error = errorParam ? ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.default : '';

    useEffect(() => {
        if (status === 'authenticated' && session) router.push(callbackUrl);
    }, [status, session, router, callbackUrl]);

    return (
        <div className="min-h-screen bg-page flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 relative mb-5">
                        <Image src="/logo/NYX-Logo.png" alt="NYX Studio" width={120} height={48} unoptimized className="h-full w-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-theme-primary">Sign in to NYX</h1>
                    <p className="mt-2 text-sm text-theme-secondary max-w-xs">
                        Internal creative workspace. Access is limited to the NYX team.
                    </p>
                </div>

                <div className="mt-8 bg-card-theme border border-theme rounded-2xl p-6">
                    {error && (
                        <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                            {error}
                        </p>
                    )}

                    <button
                        onClick={() => { setLoading(true); signIn('google', { callbackUrl }); }}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                        </svg>
                        {loading ? 'Redirecting…' : 'Continue with Google'}
                    </button>
                </div>

                <p className="mt-6 text-center text-xs text-theme-secondary">NYX Studio · internal tool</p>
            </div>
        </div>
    );
}

export default function LoginClient() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}
