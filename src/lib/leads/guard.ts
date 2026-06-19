import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config/admins';

/**
 * True when the request has a valid session whose email is on the admin
 * allowlist. Use at the top of every lead-pipeline route handler.
 */
export async function isAdminRequest(): Promise<boolean> {
    const session = await getServerSession(authOptions);
    return Boolean(session && isAdminEmail(session.user?.email));
}
