'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Play, Trash2, Upload, Loader2, ArrowLeft } from 'lucide-react';

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
    { id: 'yelp', label: 'Yelp' },
    { id: 'google_places', label: 'Google Places' },
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

    const load = useCallback(async () => {
        const [q, r] = await Promise.all([
            fetch('/api/queries').then((x) => x.json()),
            fetch('/api/runs').then((x) => x.json()),
        ]);
        setQueries(q.queries ?? []);
        setRuns(r.runs ?? []);
    }, []);

    useEffect(() => { load(); }, [load]);

    const resetForm = () => { setEditingId(null); setText(''); setRegion(''); setSources(['google_places']); };

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

    return (
        <div className="space-y-8">
            <div>
                <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-purple-500">
                    <ArrowLeft className="h-4 w-4" /> Back to leads
                </Link>
                <h1 className="mt-2 text-3xl font-bold text-theme-primary">Queries</h1>
                <p className="mt-1 text-theme-secondary">Create a search, run it, or import leads from a CSV.</p>
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

            {/* Queries list */}
            <div className="space-y-2">
                {queries.length === 0 && <p className="text-theme-secondary text-sm">No queries yet.</p>}
                {queries.map((q) => (
                    <div key={q.id} className="bg-card-theme border border-theme rounded-xl p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-theme-primary truncate">{q.text}</p>
                            <p className="text-xs text-theme-secondary">
                                {q.region ? `${q.region} · ` : ''}{q.sources.join(', ') || 'no sources'} · {q._count?.leads ?? 0} leads
                            </p>
                        </div>
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
                <h2 className="font-bold text-theme-primary mb-3">Recent runs</h2>
                <div className="bg-card-theme border border-theme rounded-2xl divide-y divide-[var(--border-color)]">
                    {runs.length === 0 && <p className="text-theme-secondary text-sm p-4">No runs yet.</p>}
                    {runs.map((r) => (
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
