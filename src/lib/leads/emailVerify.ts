import { resolveMx } from 'dns/promises';

export interface EmailVerifier {
    verify(email: string): Promise<{ valid: boolean; reason: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Free ceiling: syntax + MX-record lookup. No SMTP RCPT probing (unreliable,
// gets the IP blocked).
export class MxVerifier implements EmailVerifier {
    async verify(email: string): Promise<{ valid: boolean; reason: string }> {
        if (!EMAIL_RE.test(email)) return { valid: false, reason: 'invalid_syntax' };
        const domain = email.split('@')[1];
        try {
            const mx = await resolveMx(domain);
            return mx.length > 0
                ? { valid: true, reason: 'mx_found' }
                : { valid: false, reason: 'no_mx' };
        } catch {
            return { valid: false, reason: 'no_mx' };
        }
    }
}

// Paid, accurate verification via ZeroBounce.
export class ProviderVerifier implements EmailVerifier {
    constructor(private readonly apiKey: string) {}

    async verify(email: string): Promise<{ valid: boolean; reason: string }> {
        const url =
            `https://api.zerobounce.net/v2/validate?api_key=${this.apiKey}` +
            `&email=${encodeURIComponent(email)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`ZeroBounce ${res.status}`);
        const data = (await res.json()) as { status?: string };
        const status = data.status ?? 'unknown';
        // "catch-all" domains accept everything — treat as valid-ish.
        return { valid: status === 'valid' || status === 'catch-all', reason: status };
    }
}

/**
 * Provider when EMAIL_VERIFY_PROVIDER=zerobounce AND a key is set; otherwise MX.
 * Provider failures fall back to MX so a batch never crashes.
 */
export function getVerifier(): EmailVerifier {
    const provider = process.env.EMAIL_VERIFY_PROVIDER;
    const key = process.env.EMAIL_VERIFY_KEY;
    if (provider === 'zerobounce' && key) {
        const real = new ProviderVerifier(key);
        const mx = new MxVerifier();
        return {
            async verify(email: string) {
                try {
                    return await real.verify(email);
                } catch {
                    return mx.verify(email);
                }
            },
        };
    }
    return new MxVerifier();
}
