import { redirect } from 'next/navigation';

// NYX is now an internal admin tool — no public marketing landing.
// Send everyone to the dashboard; middleware gates unauthenticated users to /login.
export default function Home() {
    redirect('/dashboard');
}
