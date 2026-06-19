'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Settings2, Loader2, Download, CheckCheck, ShieldCheck, X, ExternalLink } from 'lucide-react';

type Lead = {
    id: string; source: string; name: string; website: string | null; email: string | null;
    phone: string | null; contactName: string | null; contactTitle: string | null; instagram: string | null;
    category: string | null; address: string | null; score: number; signals: string[];
    status: string; emailValid: boolean | null;
};

const STATUSES = ['new', 'verified', 'contacted', 'replied', 'won', 'dead'];
const STATUS_COLOR: Record<string, string> = {
    new: 'text-theme-secondary', verified: 'text-green-400', contacted: 'text-blue-400',
    replied: 'text-amber-400', won: 'text-green-400', dead: 'text-red-400',
};
const PAGE_SIZE = 25;

export default function LeadsBoard() {
    const [filters, setFilters] = useState({ status: '', source: '', minScore: '', hasEmail: '', q: '' });
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{ leads: Lead[]; total: number; pages: number }>({ leads: [], total: 0, pages: 0 });
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [drawer, setDrawer] = useState<Lead | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    const queryString = useCallback((withPage: boolean) => {
        const sp = new URLSearchParams();
        if (filters.status) sp.set('status', filters.status);
        if (filters.source) sp.set('source', filters.source);
        if (filters.minScore) sp.set('minScore', filters.minScore);
        if (filters.hasEmail) sp.set('hasEmail', filters.hasEmail);
        if (filters.q) sp.set('q', filters.q);
        if (withPage) { sp.set('page', String(page)); sp.set('pageSize', String(PAGE_SIZE)); }
        return sp.toString();
    }, [filters, page]);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/leads?${queryString(true)}`);
        const d = await res.json();
        setData({ leads: d.leads ?? [], total: d.total ?? 0, pages: d.pages ?? 0 });
        setLoading(false);
    }, [queryString]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [filters]);

    const setStatus = async (id: string, status: string) => {
        await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        setData((d) => ({ ...d, leads: d.leads.map((l) => (l.id === id ? { ...l, status } : l)) }));
    };

    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const ids = () => Array.from(selected);

    const bulkContacted = async () => {
        setMsg(null);
        await Promise.all(ids().map((id) => fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'contacted' }) })));
        setSelected(new Set()); load();
    };
    const bulkVerify = async () => {
        setMsg('Verifying…');
        const res = await fetch('/api/leads/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: ids() }) });
        const d = await res.json();
        setMsg(res.ok ? `Verified ${d.results?.length ?? 0} leads.` : d.error || 'Verify failed.');
        setSelected(new Set()); load();
    };
    const exportCsv = () => { window.open(`/api/leads/export?${queryString(false)}`, '_blank'); };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-theme-primary">Leads</h1>
                    <p className="mt-1 text-theme-secondary">{data.total} leads · sorted by score</p>
                </div>
                <Link href="/dashboard/leads/queries" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-theme text-theme-secondary hover:text-purple-500 hover:border-purple-500/30 text-sm font-semibold">
                    <Settings2 className="h-4 w-4" /> Queries
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-card-theme border border-theme rounded-2xl p-4 flex flex-wrap gap-3">
                <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search name / website" className="flex-1 min-w-[180px] bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary">
                    <option value="">All status</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary">
                    <option value="">All sources</option>
                    <option value="csv">csv</option>
                    <option value="google_places">google_places</option>
                </select>
                <select value={filters.hasEmail} onChange={(e) => setFilters((f) => ({ ...f, hasEmail: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary">
                    <option value="">Any email</option>
                    <option value="true">Has email</option>
                    <option value="false">No email</option>
                </select>
                <input value={filters.minScore} onChange={(e) => setFilters((f) => ({ ...f, minScore: e.target.value.replace(/\D/g, '') }))} placeholder="Min score" className="w-28 bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
            </div>

            {/* Bulk bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-theme-primary">{selected.size} selected</span>
                    <button onClick={bulkContacted} className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500"><CheckCheck className="h-4 w-4" /> Mark contacted</button>
                    <button onClick={bulkVerify} className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500"><ShieldCheck className="h-4 w-4" /> Verify selected</button>
                    <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500"><Download className="h-4 w-4" /> Export CSV</button>
                    {msg && <span className="text-sm text-purple-500">{msg}</span>}
                </div>
            )}

            {/* Table */}
            <div className="bg-card-theme border border-theme rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-theme-secondary border-b border-theme">
                                <th className="p-3 w-8"></th>
                                <th className="p-3">Name</th>
                                <th className="p-3 w-16">Score</th>
                                <th className="p-3">Source</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Contact</th>
                                <th className="p-3 w-32">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan={7} className="p-8 text-center text-theme-secondary"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
                            {!loading && data.leads.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-theme-secondary">No leads. Create a query and run it.</td></tr>}
                            {!loading && data.leads.map((l) => (
                                <tr key={l.id} className="border-b border-theme hover:bg-white/5">
                                    <td className="p-3"><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
                                    <td className="p-3"><button onClick={() => setDrawer(l)} className="text-theme-primary font-semibold hover:text-purple-500 text-left">{l.name}</button></td>
                                    <td className="p-3 font-bold text-purple-500">{l.score}</td>
                                    <td className="p-3"><span className="text-[10px] uppercase tracking-wider text-theme-secondary border border-theme rounded-full px-2 py-0.5">{l.source}</span></td>
                                    <td className="p-3 text-theme-secondary">{l.email ?? '—'}{l.emailValid === true && <span className="ml-1 text-green-400" title="verified">✓</span>}{l.emailValid === false && <span className="ml-1 text-red-400" title="invalid">✕</span>}</td>
                                    <td className="p-3 text-theme-secondary">{l.contactName ?? '—'}</td>
                                    <td className="p-3">
                                        <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} className={`bg-secondary border border-theme rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_COLOR[l.status]}`}>
                                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
                <div className="flex items-center justify-center gap-4 text-sm">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-theme text-theme-secondary disabled:opacity-40">Prev</button>
                    <span className="text-theme-secondary">Page {page} of {data.pages}</span>
                    <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-theme text-theme-secondary disabled:opacity-40">Next</button>
                </div>
            )}

            {/* Detail drawer */}
            {drawer && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawer(null)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="relative w-full max-w-md h-full bg-card-theme border-l border-theme p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setDrawer(null)} className="absolute top-4 right-4 text-theme-secondary hover:text-theme-primary"><X className="h-5 w-5" /></button>
                        <h2 className="text-xl font-bold text-theme-primary pr-8">{drawer.name}</h2>
                        <p className="mt-1 text-sm text-theme-secondary">Score {drawer.score} · {drawer.status}</p>

                        {drawer.signals.length > 0 && (
                            <div className="mt-5">
                                <p className="text-xs uppercase tracking-wider text-theme-secondary mb-2">Why this lead</p>
                                <ul className="space-y-1.5">
                                    {drawer.signals.map((s, i) => <li key={i} className="text-sm text-theme-primary flex gap-2"><span className="text-purple-500">•</span>{s}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="mt-5 space-y-2 text-sm">
                            {([['Email', drawer.email], ['Phone', drawer.phone], ['Contact', drawer.contactName], ['Title', drawer.contactTitle], ['Category', drawer.category], ['Address', drawer.address]] as const).map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4 border-b border-theme pb-1.5">
                                    <span className="text-theme-secondary">{k}</span>
                                    <span className="text-theme-primary text-right">{v ?? '—'}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 flex flex-col gap-2">
                            {drawer.website && <a href={drawer.website.startsWith('http') ? drawer.website : `https://${drawer.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-500"><ExternalLink className="h-4 w-4" /> Website</a>}
                            {drawer.instagram && <a href={drawer.instagram.startsWith('http') ? drawer.instagram : `https://instagram.com/${drawer.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-500"><ExternalLink className="h-4 w-4" /> Instagram</a>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
