'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import {
    Settings2, Loader2, Download, CheckCheck, ShieldCheck, X, ExternalLink,
    Flame, Thermometer, Snowflake, Copy, Check, MapPin,
} from 'lucide-react';

const mapsUrl = (name: string, address: string | null) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ? `${name}, ${address}` : name)}`;
import PageHeader from '@/components/PageHeader';

type Temp = 'hot' | 'warm' | 'cold' | null;
type Lead = {
    id: string; source: string; name: string; website: string | null; email: string | null;
    phone: string | null; contactName: string | null; contactTitle: string | null; instagram: string | null;
    category: string | null; address: string | null; score: number; signals: string[];
    status: string; temperature: Temp; emailValid: boolean | null;
};

const STATUSES = ['new', 'verified', 'contacted', 'replied', 'won', 'dead'];
const STATUS_COLOR: Record<string, string> = {
    new: 'text-theme-secondary', verified: 'text-green-400', contacted: 'text-blue-400',
    replied: 'text-amber-400', won: 'text-green-400', dead: 'text-red-400',
};
const TEMPS = {
    hot: { label: 'Hot', color: '#ef4444', Icon: Flame },
    warm: { label: 'Warm', color: '#f59e0b', Icon: Thermometer },
    cold: { label: 'Cold', color: '#3b82f6', Icon: Snowflake },
} as const;
const TEMP_ORDER: Temp[] = ['hot', 'warm', 'cold', null];
const nextTemp = (t: Temp): Temp => TEMP_ORDER[(TEMP_ORDER.indexOf(t) + 1) % TEMP_ORDER.length];
const PAGE_SIZE = 25;

export default function LeadsBoard() {
    const [filters, setFilters] = useState({ status: '', source: '', temperature: '', minScore: '', hasEmail: '', q: '', queryId: '' });
    const [queryLabel, setQueryLabel] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{ leads: Lead[]; total: number; pages: number }>({ leads: [], total: 0, pages: 0 });
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [drawer, setDrawer] = useState<Lead | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const queryString = useCallback((withPage: boolean) => {
        const sp = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) sp.set(k, v); });
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

    // Pick up a ?queryId=…&queryLabel=… deep-link from the Queries page.
    useEffect(() => {
        const qp = new URLSearchParams(window.location.search);
        const qid = qp.get('queryId');
        if (qid) {
            setFilters((f) => ({ ...f, queryId: qid }));
            setQueryLabel(qp.get('queryLabel'));
        }
    }, []);

    const clearQueryFilter = () => {
        setFilters((f) => ({ ...f, queryId: '' }));
        setQueryLabel(null);
        window.history.replaceState(null, '', '/dashboard/leads');
    };

    // GSAP: stagger rows in when data lands.
    useEffect(() => {
        if (!loading && tbodyRef.current) {
            const rows = tbodyRef.current.querySelectorAll('tr');
            if (rows.length) gsap.fromTo(rows, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.015, ease: 'power2.out' });
        }
    }, [data.leads, loading]);

    // GSAP: slide the viewer in.
    useEffect(() => {
        if (drawer && panelRef.current) {
            gsap.fromTo(panelRef.current, { x: '100%' }, { x: 0, duration: 0.32, ease: 'power3.out' });
        }
    }, [drawer]);

    const patch = async (id: string, body: Record<string, unknown>) => {
        await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    };
    const setStatus = async (id: string, status: string) => {
        await patch(id, { status });
        setData((d) => ({ ...d, leads: d.leads.map((l) => (l.id === id ? { ...l, status } : l)) }));
        setDrawer((dr) => (dr && dr.id === id ? { ...dr, status } : dr));
    };
    const setTemp = async (id: string, temperature: Temp) => {
        await patch(id, { temperature });
        setData((d) => ({ ...d, leads: d.leads.map((l) => (l.id === id ? { ...l, temperature } : l)) }));
        setDrawer((dr) => (dr && dr.id === id ? { ...dr, temperature } : dr));
    };

    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const ids = () => Array.from(selected);
    const copy = (text: string) => { navigator.clipboard?.writeText(text); setCopied(text); setTimeout(() => setCopied(null), 1200); };

    const bulkContacted = async () => { await Promise.all(ids().map((id) => patch(id, { status: 'contacted' }))); setSelected(new Set()); load(); };
    const bulkVerify = async () => {
        setMsg('Verifying…');
        const res = await fetch('/api/leads/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: ids() }) });
        const d = await res.json();
        setMsg(res.ok ? `Verified ${d.results?.length ?? 0} leads.` : d.error || 'Verify failed.');
        setSelected(new Set()); load();
    };
    const exportCsv = () => window.open(`/api/leads/export?${queryString(false)}`, '_blank');

    const TempButton = ({ t, onPick }: { t: Temp; onPick: (next: Temp) => void }) => {
        const cfg = t ? TEMPS[t] : null;
        const Icon = cfg?.Icon;
        return (
            <button
                onClick={(e) => { e.stopPropagation(); onPick(nextTemp(t)); }}
                title={cfg ? cfg.label : 'Set temperature'}
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-theme hover:border-purple-500/40 transition-colors"
                style={cfg ? { color: cfg.color, borderColor: `${cfg.color}55`, background: `${cfg.color}14` } : undefined}
            >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />}
            </button>
        );
    };

    return (
        <div className="space-y-5">
            <PageHeader
                index="03"
                kicker="Pipeline"
                title="Leads"
                subtitle={`${data.total} total · sorted by score`}
                right={
                    <Link href="/dashboard/leads/queries" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-theme text-theme-secondary hover:text-purple-500 hover:border-purple-500/30 text-sm font-semibold">
                        <Settings2 className="h-4 w-4" /> Queries
                    </Link>
                }
            />

            {/* Active query filter (deep-linked from Queries) */}
            {filters.queryId && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-500 font-semibold">
                        <Settings2 className="h-3.5 w-3.5" />
                        {queryLabel ? `Query: ${queryLabel}` : 'Filtered to one query'}
                        <button onClick={clearQueryFilter} className="hover:text-theme-primary" title="Clear query filter"><X className="h-3.5 w-3.5" /></button>
                    </span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-card-theme border border-theme rounded-xl p-3 flex flex-wrap gap-2">
                <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search name / website" className="flex-1 min-w-[160px] bg-secondary border border-theme rounded-lg px-3 py-1.5 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                <select value={filters.temperature} onChange={(e) => setFilters((f) => ({ ...f, temperature: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                    <option value="">Any temp</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option>
                </select>
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                    <option value="">All status</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                    <option value="">All sources</option><option value="openstreetmap">openstreetmap</option><option value="yelp">yelp</option><option value="google_places">google_places</option><option value="csv">csv</option>
                </select>
                <select value={filters.hasEmail} onChange={(e) => setFilters((f) => ({ ...f, hasEmail: e.target.value }))} className="bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                    <option value="">Any email</option><option value="true">Has email</option><option value="false">No email</option>
                </select>
                <input value={filters.minScore} onChange={(e) => setFilters((f) => ({ ...f, minScore: e.target.value.replace(/\D/g, '') }))} placeholder="Min score" className="w-24 bg-secondary border border-theme rounded-lg px-3 py-1.5 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
            </div>

            {/* Bulk bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2.5">
                    <span className="text-sm font-semibold text-theme-primary">{selected.size} selected</span>
                    <button onClick={bulkContacted} className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500"><CheckCheck className="h-4 w-4" /> Mark contacted</button>
                    <button onClick={bulkVerify} className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500"><ShieldCheck className="h-4 w-4" /> Verify</button>
                    <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500"><Download className="h-4 w-4" /> Export CSV</button>
                    {msg && <span className="text-sm text-purple-500">{msg}</span>}
                </div>
            )}

            {/* Table */}
            <div className="bg-card-theme border border-theme rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-theme-secondary border-b border-theme text-[11px] uppercase tracking-wider">
                                <th className="p-2.5 w-8"></th>
                                <th className="p-2.5 w-9">Temp</th>
                                <th className="p-2.5">Name</th>
                                <th className="p-2.5 w-24">Score</th>
                                <th className="p-2.5">Email</th>
                                <th className="p-2.5">Contact</th>
                                <th className="p-2.5 w-28">Status</th>
                            </tr>
                        </thead>
                        <tbody ref={tbodyRef}>
                            {loading && <tr><td colSpan={7} className="p-8 text-center text-theme-secondary"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
                            {!loading && data.leads.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-theme-secondary">No leads. Create a query and run it.</td></tr>}
                            {!loading && data.leads.map((l) => (
                                <tr key={l.id} className="border-b border-theme hover:bg-white/5 cursor-pointer" onClick={() => setDrawer(l)}>
                                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
                                    <td className="p-2.5"><TempButton t={l.temperature} onPick={(nt) => setTemp(l.id, nt)} /></td>
                                    <td className="p-2.5">
                                        <span className="text-theme-primary font-semibold">{l.name}</span>
                                        <span className="flex items-center gap-1.5 text-[11px] text-theme-secondary mt-0.5">
                                            {l.address ? (
                                                <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate max-w-[200px]">{l.address}</span></span>
                                            ) : (
                                                l.category && <span>{l.category}</span>
                                            )}
                                            <a href={mapsUrl(l.name, l.address)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-purple-500 hover:underline flex-shrink-0">map</a>
                                        </span>
                                    </td>
                                    <td className="p-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-purple-500 tabular-nums w-7">{l.score}</span>
                                            <span className="h-1.5 flex-1 max-w-[48px] rounded-full bg-white/10 overflow-hidden"><span className="block h-full bg-purple-500" style={{ width: `${Math.min(l.score, 100)}%` }} /></span>
                                        </div>
                                    </td>
                                    <td className="p-2.5 text-theme-secondary">{l.email ?? '—'}{l.emailValid === true && <span className="ml-1 text-green-400" title="verified">✓</span>}{l.emailValid === false && <span className="ml-1 text-red-400" title="invalid">✕</span>}</td>
                                    <td className="p-2.5 text-theme-secondary">{l.contactName ?? '—'}</td>
                                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
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

            {/* Lead viewer */}
            {drawer && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawer(null)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div ref={panelRef} className="relative w-full max-w-md h-full bg-card-theme border-l border-theme overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-5">
                            <button onClick={() => setDrawer(null)} className="absolute top-4 right-4 text-theme-secondary hover:text-theme-primary"><X className="h-5 w-5" /></button>

                            <div className="pr-8">
                                <h2 className="text-xl font-bold text-theme-primary">{drawer.name}</h2>
                                <p className="mt-0.5 text-sm text-theme-secondary">{drawer.category ?? drawer.source}</p>
                            </div>

                            {/* Score + temperature + status */}
                            <div className="flex items-center gap-3">
                                <div className="bg-secondary border border-theme rounded-xl px-4 py-2 text-center">
                                    <div className="text-2xl font-bold text-purple-500 tabular-nums">{drawer.score}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-theme-secondary">score</div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] uppercase tracking-wider text-theme-secondary mb-1.5">Temperature</div>
                                    <div className="flex gap-1.5">
                                        {(['hot', 'warm', 'cold'] as const).map((k) => {
                                            const { color, Icon, label } = TEMPS[k];
                                            const on = drawer.temperature === k;
                                            return (
                                                <button key={k} onClick={() => setTemp(drawer.id, on ? null : k)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                                                    style={on ? { color, borderColor: `${color}66`, background: `${color}1f` } : { borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                                    <Icon className="h-3.5 w-3.5" /> {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-theme-secondary mb-1.5">Status</div>
                                <select value={drawer.status} onChange={(e) => setStatus(drawer.id, e.target.value)} className={`w-full bg-secondary border border-theme rounded-lg px-3 py-2 text-sm font-semibold ${STATUS_COLOR[drawer.status]}`}>
                                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {drawer.signals.length > 0 && (
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider text-theme-secondary mb-2">Why this lead</div>
                                    <ul className="space-y-1.5">
                                        {drawer.signals.map((s, i) => <li key={i} className="text-sm text-theme-primary flex gap-2"><span className="text-purple-500">•</span>{s}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="space-y-1.5 text-sm">
                                {([['Email', drawer.email], ['Phone', drawer.phone], ['Contact', drawer.contactName], ['Title', drawer.contactTitle], ['Address', drawer.address]] as const).map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-3 items-center border-b border-theme pb-1.5">
                                        <span className="text-theme-secondary">{k}</span>
                                        <span className="text-theme-primary text-right flex items-center gap-2">
                                            {v ?? '—'}
                                            {v && (k === 'Email' || k === 'Phone') && (
                                                <button onClick={() => copy(v)} className="text-theme-secondary hover:text-purple-500">{copied === v ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-4">
                                {drawer.website && <a href={drawer.website.startsWith('http') ? drawer.website : `https://${drawer.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-500"><ExternalLink className="h-4 w-4" /> Website</a>}
                                <a href={mapsUrl(drawer.name, drawer.address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-500"><MapPin className="h-4 w-4" /> Google Maps</a>
                                {drawer.instagram && <a href={drawer.instagram.startsWith('http') ? drawer.instagram : `https://instagram.com/${drawer.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-500"><ExternalLink className="h-4 w-4" /> Instagram</a>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
