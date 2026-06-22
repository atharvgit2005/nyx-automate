'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Play, Trash2, Upload, Loader2, ArrowLeft, Eye, Sparkles, Copy, Target, FileText, Printer } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

type Prospect = {
    name: string; website?: string; category?: string;
    igHandle?: string | null; igFollowers?: string | null; igFound?: boolean;
    opportunity: number; weaknesses: string; pitch: string;
};
type Report = {
    business: string; snapshot: string; igHandle: string | null; igFollowers: string | null; igFound: boolean;
    problems: string[]; recommendations: string[]; contentIdeas: string[]; closing: string;
};

type Query = {
    id: string;
    text: string;
    region: string | null;
    sources: string[];
    enabled: boolean;
    _count?: { leads: number; runs: number };
};
type Run = {
    id: string;
    status: string;
    leadCount: number;
    error: string | null;
    createdAt: string;
    query: { text: string } | null;
};

const SOURCES = [
    { id: 'openstreetmap', label: 'OpenStreetMap (free)' },
    { id: 'yelp', label: 'Yelp (paid)' },
    { id: 'google_places', label: 'Google Places (billing)' },
    { id: 'csv', label: 'CSV import' },
];

const RUN_STATUS: Record<string, string> = {
    done: 'text-green-400', running: 'text-amber-400', queued: 'text-theme-secondary', failed: 'text-red-400',
};

export default function QueriesPage() {
    const [queries, setQueries] = useState<Query[]>([]);
    const [runs, setRuns] = useState<Run[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [region, setRegion] = useState('');
    const [sources, setSources] = useState<string[]>(['openstreetmap']);
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    // Client-finder (prospecting)
    const [pQuery, setPQuery] = useState('');
    const [pLimit, setPLimit] = useState(6);
    const [pBusy, setPBusy] = useState(false);
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [copied, setCopied] = useState<number | null>(null);
    const [reports, setReports] = useState<Record<number, Report>>({});
    const [reportBusy, setReportBusy] = useState<number | null>(null);

    // Filters for the queries list + runs list.
    const [qSearch, setQSearch] = useState('');
    const [qSource, setQSource] = useState('');
    const [qEnabled, setQEnabled] = useState('');
    const [runStatus, setRunStatus] = useState('');

    const load = useCallback(async () => {
        const [q, r] = await Promise.all([
            fetch('/api/queries').then((x) => x.json()),
            fetch('/api/runs').then((x) => x.json()),
        ]);
        setQueries(q.queries ?? []);
        setRuns(r.runs ?? []);
    }, []);

    useEffect(() => { load(); }, [load]);

    const resetForm = () => { setEditingId(null); setText(''); setRegion(''); setSources(['openstreetmap']); };

    const save = async () => {
        if (!text.trim()) { setMsg('Query text is required.'); return; }
        setBusy('save'); setMsg(null);
        const payload = { text, region: region || null, sources, enabled: true };
        const res = editingId
            ? await fetch(`/api/queries/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            : await fetch('/api/queries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        setBusy(null);
        if (!res.ok) { setMsg((await res.json()).error || 'Save failed.'); return; }
        resetForm(); load();
    };

    const run = async (id: string) => {
        setBusy(id); setMsg(null);
        const res = await fetch('/api/scrape/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queryId: id }) });
        setBusy(null);
        const data = await res.json();
        if (!res.ok) { setMsg(data.error || 'Run failed.'); return; }
        setMsg(data.mode === 'n8n' ? 'Sent to n8n.' : `Run done — ${data.run?.leadCount ?? 0} leads.`);
        load();
    };

    const findProspects = async () => {
        if (!pQuery.trim()) { setMsg('Enter a search like "cafes in Mumbai".'); return; }
        setPBusy(true); setMsg(null); setProspects([]);
        const res = await fetch('/api/leads/prospect', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: pQuery, limit: pLimit }),
        });
        const data = await res.json();
        setPBusy(false);
        if (!res.ok) { setMsg(data.error || 'Prospecting failed.'); return; }
        setProspects(data.prospects ?? []);
        setMsg(`Found ${data.count} prospects — saved to leads + the Airtable Outreach table.`);
    };

    const copyPitch = (i: number, pitch: string) => {
        navigator.clipboard?.writeText(pitch);
        setCopied(i);
        setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    };

    const makeReport = async (i: number, p: Prospect) => {
        setReportBusy(i); setMsg(null);
        const res = await fetch('/api/leads/report', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: p.name, website: p.website, instagram: p.igHandle, category: p.category }),
        });
        const data = await res.json();
        setReportBusy(null);
        if (!res.ok) { setMsg(data.error || 'Report failed.'); return; }
        setReports((r) => ({ ...r, [i]: data.report }));
    };

    const printReport = (r: Report) => {
        const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
        const li = (items: string[]) => items.map((x) => `<li>${esc(x)}</li>`).join('');
        const html = `<!doctype html><html><head><meta charset="utf8"><title>${esc(r.business)} — Social Audit</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.6}
h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:#888;margin:28px 0 8px}
.sub{color:#666;margin:0 0 8px}ul{padding-left:20px;margin:0}li{margin:4px 0}.brand{color:#7c3aed;font-weight:700}.close{background:#f4f0fe;border-radius:12px;padding:16px;margin-top:24px}</style></head>
<body><p class="brand">NYX · Social Media Audit</p><h1>${esc(r.business)}</h1>
<p class="sub">${r.igFound ? `@${esc(r.igHandle || '')} · ${esc(r.igFollowers || '')} followers` : 'Instagram not found'}</p>
<p>${esc(r.snapshot)}</p>
<h2>What's holding you back</h2><ul>${li(r.problems)}</ul>
<h2>What we'd do</h2><ul>${li(r.recommendations)}</ul>
<h2>Content ideas to start with</h2><ul>${li(r.contentIdeas)}</ul>
<div class="close">${esc(r.closing)}</div></body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
    };

    const remove = async (id: string) => {
        setBusy(id);
        await fetch(`/api/queries/${id}`, { method: 'DELETE' });
        setBusy(null); load();
    };

    const importCsv = async (file: File) => {
        setBusy('import'); setMsg(null);
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/queries/import', { method: 'POST', body: fd });
        setBusy(null);
        const data = await res.json();
        setMsg(res.ok ? `Imported ${data.imported} leads.` : data.error || 'Import failed.');
        load();
    };

    const toggleSource = (id: string) =>
        setSources((p) => (p.includes(id) ? p.filter((s) => s !== id) : [...p, id]));

    const filteredQueries = useMemo(() => queries.filter((q) => {
        if (qSearch && !`${q.text} ${q.region ?? ''}`.toLowerCase().includes(qSearch.toLowerCase())) return false;
        if (qSource && !q.sources.includes(qSource)) return false;
        if (qEnabled === 'enabled' && !q.enabled) return false;
        if (qEnabled === 'disabled' && q.enabled) return false;
        return true;
    }), [queries, qSearch, qSource, qEnabled]);

    const filteredRuns = useMemo(
        () => (runStatus ? runs.filter((r) => r.status === runStatus) : runs),
        [runs, runStatus],
    );

    const clearFilters = () => { setQSearch(''); setQSource(''); setQEnabled(''); };
    const filtersActive = qSearch || qSource || qEnabled;

    return (
        <div className="space-y-8">
            <div>
                <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500 mb-3">
                    <ArrowLeft className="h-4 w-4" /> Back to leads
                </Link>
                <PageHeader
                    index="03"
                    kicker="Pipeline · Setup"
                    title="Queries"
                    subtitle="Create a search, run it, or import leads from a CSV."
                />
            </div>

            {msg && <p className="text-sm text-purple-500 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">{msg}</p>}

            {/* Create / edit */}
            <div className="bg-card-theme border border-theme rounded-2xl p-5 space-y-4">
                <h2 className="font-bold text-theme-primary">{editingId ? 'Edit query' : 'New query'}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. dental clinics in Mumbai" className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                    <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region (ISO, e.g. IN) — optional" className="bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {SOURCES.map((s) => (
                        <button key={s.id} onClick={() => toggleSource(s.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${sources.includes(s.id) ? 'bg-purple-600 text-white border-transparent' : 'bg-secondary border-theme text-theme-secondary'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button onClick={save} disabled={busy === 'save'} className="bg-purple-600 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50">
                        {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {editingId ? 'Save' : 'Create'}
                    </button>
                    {editingId && <button onClick={resetForm} className="px-4 py-2 rounded-xl border border-theme text-theme-secondary text-sm">Cancel</button>}
                    <label className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-theme text-theme-secondary text-sm cursor-pointer hover:text-purple-500 hover:border-purple-500/30">
                        {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
                    </label>
                </div>
            </div>

            {/* Client-finder / prospecting */}
            <div className="bg-card-theme border border-theme rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <h2 className="font-bold text-theme-primary">Find prospects</h2>
                    <span className="text-xs text-theme-secondary">finds businesses, checks their Instagram, drafts an outreach pitch</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        value={pQuery}
                        onChange={(e) => setPQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !pBusy && findProspects()}
                        placeholder="e.g. salons in Indiranagar Bangalore"
                        className="flex-1 bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 bg-secondary border border-theme rounded-lg px-3">
                        <span className="text-xs text-theme-secondary whitespace-nowrap">How many</span>
                        <input type="number" min={1} max={15} value={pLimit} onChange={(e) => setPLimit(Math.min(15, Math.max(1, Number(e.target.value) || 1)))} className="w-12 bg-transparent text-sm text-theme-primary outline-none" />
                    </div>
                    <button onClick={findProspects} disabled={pBusy} className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-50">
                        {pBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {pBusy ? 'Finding…' : 'Find prospects'}
                    </button>
                </div>

                {prospects.length > 0 && (
                    <div className="space-y-3 pt-1">
                        {prospects.map((p, i) => (
                            <div key={i} className="border border-theme rounded-xl p-4 bg-secondary/40">
                                <div className="flex items-start gap-3">
                                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${p.opportunity >= 80 ? 'bg-green-500/15 text-green-500' : p.opportunity >= 50 ? 'bg-amber-500/15 text-amber-500' : 'bg-theme/10 text-theme-secondary'}`}>
                                        {p.opportunity}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-theme-primary">{p.name}</p>
                                        <p className="text-xs text-theme-secondary">
                                            {p.category ? `${p.category} · ` : ''}
                                            {p.igFound ? `@${p.igHandle} · ${p.igFollowers} followers` : (p.igHandle ? `@${p.igHandle} (couldn’t load)` : 'Instagram not found')}
                                        </p>
                                        {p.weaknesses && <p className="text-xs text-theme-secondary mt-1">{p.weaknesses}</p>}
                                        <p className="text-sm text-theme-primary mt-2 leading-relaxed">{p.pitch}</p>
                                    </div>
                                    <div className="shrink-0 flex flex-col gap-1.5">
                                        <button onClick={() => copyPitch(i, p.pitch)} className="inline-flex items-center gap-1 text-xs text-theme-secondary hover:text-purple-500 border border-theme rounded-lg px-2 py-1">
                                            <Copy className="h-3 w-3" /> {copied === i ? 'Copied' : 'Copy'}
                                        </button>
                                        <button onClick={() => makeReport(i, p)} disabled={reportBusy === i} className="inline-flex items-center gap-1 text-xs text-theme-secondary hover:text-purple-500 border border-theme rounded-lg px-2 py-1 disabled:opacity-50">
                                            {reportBusy === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Report
                                        </button>
                                    </div>
                                </div>
                                {reports[i] && (
                                    <div className="mt-3 border-t border-theme pt-3 space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-theme-primary uppercase tracking-wide text-[11px]">Social audit</span>
                                            <button onClick={() => printReport(reports[i])} className="inline-flex items-center gap-1 text-purple-500 hover:underline"><Printer className="h-3 w-3" /> Print / PDF</button>
                                        </div>
                                        {reports[i].snapshot && <p className="text-theme-secondary">{reports[i].snapshot}</p>}
                                        <ReportList title="Problems" items={reports[i].problems} />
                                        <ReportList title="Recommendations" items={reports[i].recommendations} />
                                        <ReportList title="Content ideas" items={reports[i].contentIdeas} />
                                        {reports[i].closing && <p className="text-theme-primary italic">{reports[i].closing}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Queries list */}
            <div className="space-y-3">
                {/* Filters */}
                <div className="bg-card-theme border border-theme rounded-xl p-3 flex flex-wrap items-center gap-2">
                    <input value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="Search queries (text / region)" className="flex-1 min-w-[180px] bg-secondary border border-theme rounded-lg px-3 py-1.5 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
                    <select value={qSource} onChange={(e) => setQSource(e.target.value)} className="bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                        <option value="">All sources</option>
                        {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <select value={qEnabled} onChange={(e) => setQEnabled(e.target.value)} className="bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                        <option value="">Any state</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                    </select>
                    {filtersActive && <button onClick={clearFilters} className="text-sm text-theme-secondary hover:text-purple-500 px-2">Clear</button>}
                    <span className="text-xs text-theme-secondary ml-auto">{filteredQueries.length} of {queries.length}</span>
                </div>

                {queries.length === 0 && <p className="text-theme-secondary text-sm">No queries yet.</p>}
                {queries.length > 0 && filteredQueries.length === 0 && <p className="text-theme-secondary text-sm">No queries match these filters.</p>}
                {filteredQueries.map((q) => (
                    <div key={q.id} className="bg-card-theme border border-theme rounded-xl p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-theme-primary truncate">{q.text}{!q.enabled && <span className="ml-2 text-[10px] uppercase tracking-wider text-theme-secondary border border-theme rounded px-1.5 py-0.5">off</span>}</p>
                            <p className="text-xs text-theme-secondary">
                                {q.region ? `${q.region} · ` : ''}{q.sources.join(', ') || 'no sources'} · {q._count?.leads ?? 0} leads
                            </p>
                        </div>
                        <Link href={`/dashboard/leads?queryId=${q.id}&queryLabel=${encodeURIComponent(q.text)}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary hover:text-purple-500 hover:border-purple-500/30 text-sm font-semibold">
                            <Eye className="h-4 w-4" /> View leads
                        </Link>
                        <button onClick={() => run(q.id)} disabled={busy === q.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-50">
                            {busy === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
                        </button>
                        <button onClick={() => { setEditingId(q.id); setText(q.text); setRegion(q.region ?? ''); setSources(q.sources); }} className="text-sm text-theme-secondary hover:text-purple-500">Edit</button>
                        <button onClick={() => remove(q.id)} className="text-theme-secondary hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                ))}
            </div>

            {/* Recent runs */}
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-bold text-theme-primary">Recent runs</h2>
                    <select value={runStatus} onChange={(e) => setRunStatus(e.target.value)} className="ml-auto bg-secondary border border-theme rounded-lg px-2.5 py-1.5 text-sm text-theme-primary">
                        <option value="">All status</option>
                        {Object.keys(RUN_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="bg-card-theme border border-theme rounded-2xl divide-y divide-[var(--border-color)]">
                    {filteredRuns.length === 0 && <p className="text-theme-secondary text-sm p-4">{runs.length === 0 ? 'No runs yet.' : 'No runs match this status.'}</p>}
                    {filteredRuns.map((r) => (
                        <div key={r.id} className="flex items-center gap-4 p-3 text-sm">
                            <span className={`font-semibold uppercase text-xs ${RUN_STATUS[r.status] ?? 'text-theme-secondary'}`}>{r.status}</span>
                            <span className="text-theme-primary truncate flex-1">{r.query?.text ?? '—'}</span>
                            <span className="text-theme-secondary">{r.leadCount} leads</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
    if (!items?.length) return null;
    return (
        <div>
            <p className="font-semibold text-theme-primary">{title}</p>
            <ul className="list-disc pl-4 text-theme-secondary space-y-0.5 mt-0.5">
                {items.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
        </div>
    );
}
