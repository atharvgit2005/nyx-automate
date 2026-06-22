'use client';

import { useState } from 'react';
import { Sparkles, Wand2, ImageIcon, Loader2, Download } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const MODELS = [
    { id: 'flux-free', name: 'Flux', vendor: 'Free · Pollinations', note: 'Free & unlimited, Higgsfield-style look', tag: 'free' },
    { id: 'gpt-image-1', name: 'GPT-Image', vendor: 'OpenAI', note: 'Top quality + text in image (costs per image)', tag: 'paid' },
    { id: 'gemini-image', name: 'Nano Banana', vendor: 'Gemini · free tier', note: 'Fast generation + edits (needs free key)', tag: 'key' },
];

const TAG_STYLES: Record<string, string> = {
    free: 'text-green-400 border-green-500/30 bg-green-500/10',
    paid: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    key: 'text-theme-secondary border-theme bg-white/5',
};
const TAG_LABEL: Record<string, string> = { free: 'free', paid: 'paid', key: 'add key' };

const ASPECTS = ['1:1', '4:5', '3:2', '16:9', '9:16'];

type Field = { key: string; label: string; placeholder: string };
type Template = { id: string; label: string; template: string; fields: Field[] };

const TEMPLATES: Template[] = [
    {
        id: 'product',
        label: 'Product hero shot',
        template: 'A premium product hero shot of {product}, on {surface}, {lighting} lighting, seamless gradient backdrop, ultra-sharp, commercial photography, 85mm lens, high detail',
        fields: [
            { key: 'product', label: 'Product', placeholder: 'a matte black water bottle' },
            { key: 'surface', label: 'Surface / background', placeholder: 'a polished stone slab' },
            { key: 'lighting', label: 'Lighting / mood', placeholder: 'soft studio' },
        ],
    },
    {
        id: 'portrait',
        label: 'Cinematic portrait',
        template: 'Cinematic portrait of {subject}, {setting}, dramatic rim lighting, shallow depth of field, film grain, {mood} color grade',
        fields: [
            { key: 'subject', label: 'Subject', placeholder: 'a young founder in a denim jacket' },
            { key: 'setting', label: 'Setting', placeholder: 'a neon-lit city street at night' },
            { key: 'mood', label: 'Color mood', placeholder: 'moody teal-and-orange' },
        ],
    },
    {
        id: 'moodboard',
        label: 'Brand moodboard',
        template: 'A cohesive brand moodboard for {brand}, {style} aesthetic, color palette of {palette}, curated editorial flat-lay layout',
        fields: [
            { key: 'brand', label: 'Brand / niche', placeholder: 'a premium coffee brand' },
            { key: 'style', label: 'Style', placeholder: 'minimal Scandinavian' },
            { key: 'palette', label: 'Colors', placeholder: 'cream, sage, charcoal' },
        ],
    },
    {
        id: 'ad',
        label: 'Social ad creative',
        template: 'Scroll-stopping social ad creative for {offer}, {vibe} vibe, bold composition with clear empty space for a headline at the {space}, vibrant but on-brand',
        fields: [
            { key: 'offer', label: 'Product / offer', placeholder: '50% off summer sale' },
            { key: 'vibe', label: 'Vibe', placeholder: 'energetic and youthful' },
            { key: 'space', label: 'Headline space', placeholder: 'top' },
        ],
    },
];

type Result = { image: string; prompt: string; model: string; aspect: string };

export default function ImageStudio() {
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('flux-free');
    const [aspect, setAspect] = useState('1:1');
    const [busy, setBusy] = useState<false | 'refine' | 'generate'>(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    const [tplId, setTplId] = useState<string | null>(null);
    const [fields, setFields] = useState<Record<string, string>>({});

    const activeTpl = TEMPLATES.find((t) => t.id === tplId) ?? null;

    const openTemplate = (t: Template) => {
        setTplId((cur) => (cur === t.id ? null : t.id));
        setFields({});
    };

    const buildFromTemplate = () => {
        if (!activeTpl) return;
        let out = activeTpl.template;
        for (const f of activeTpl.fields) {
            const value = (fields[f.key] || f.placeholder).trim();
            out = out.split(`{${f.key}}`).join(value);
        }
        setPrompt(out);
        setTplId(null);
        setError(null);
    };

    const onRefine = async () => {
        if (!prompt.trim()) { setError('Write a rough idea first, then refine it.'); return; }
        setError(null);
        setBusy('refine');
        try {
            const res = await fetch('/api/studio/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Refinement failed.');
            setPrompt(data.prompt);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Refinement failed.');
        } finally {
            setBusy(false);
        }
    };

    const onGenerate = async () => {
        if (!prompt.trim()) { setError('Add a prompt to generate.'); return; }
        setError(null);
        setBusy('generate');
        try {
            const res = await fetch('/api/studio/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, aspect, model }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed.');
            setResults((prev) => [{ image: data.image, prompt, model, aspect }, ...prev]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Generation failed.');
        } finally {
            setBusy(false);
        }
    };

    const latest = results[0];

    return (
        <div>
            <PageHeader
                index="01"
                kicker="Create"
                title="Image Studio"
                subtitle="Build a prompt, pick a model, and generate. Templates give you a head start."
                icon={<Sparkles className="h-8 w-8 text-purple-500" />}
            />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Controls */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Prompt */}
                    <div className="bg-card-theme border border-theme rounded-2xl p-5">
                        <label className="text-sm font-semibold text-theme-primary">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={5}
                            placeholder="Describe the image you want…"
                            className="mt-3 w-full bg-secondary border border-theme rounded-xl p-3 text-theme-primary placeholder-gray-500 resize-y focus:border-purple-500/50 focus:outline-none text-sm leading-relaxed"
                        />
                        <button
                            onClick={onRefine}
                            disabled={!!busy}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-500/30 text-purple-500 hover:bg-purple-500/10 font-semibold text-sm disabled:opacity-50"
                        >
                            {busy === 'refine' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            Refine with AI
                        </button>
                    </div>

                    {/* Templates */}
                    <div className="bg-card-theme border border-theme rounded-2xl p-5">
                        <label className="text-sm font-semibold text-theme-primary">Templates</label>
                        <p className="text-xs text-theme-secondary mt-1">Pick one, fill the boxes, and it writes the prompt for you.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {TEMPLATES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => openTemplate(t)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tplId === t.id
                                        ? 'bg-purple-600 text-white border-transparent'
                                        : 'bg-secondary border-theme text-theme-secondary hover:text-purple-500 hover:border-purple-500/30'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {activeTpl && (
                            <div className="mt-4 space-y-3">
                                {activeTpl.fields.map((f) => (
                                    <div key={f.key}>
                                        <label className="text-xs text-theme-secondary">{f.label}</label>
                                        <input
                                            value={fields[f.key] ?? ''}
                                            onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            className="mt-1 w-full bg-secondary border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                                        />
                                    </div>
                                ))}
                                <button
                                    onClick={buildFromTemplate}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm"
                                >
                                    <Wand2 className="h-4 w-4" /> Build prompt
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Model */}
                    <div className="bg-card-theme border border-theme rounded-2xl p-5">
                        <label className="text-sm font-semibold text-theme-primary">Model</label>
                        <div className="mt-3 space-y-2">
                            {MODELS.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setModel(m.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${model === m.id
                                        ? 'border-purple-500/50 bg-purple-500/10'
                                        : 'border-theme bg-secondary hover:border-purple-500/20'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm text-theme-primary">{m.name}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase tracking-wider text-theme-secondary">{m.vendor}</span>
                                            <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${TAG_STYLES[m.tag]}`}>
                                                {TAG_LABEL[m.tag]}
                                            </span>
                                        </span>
                                    </div>
                                    <p className="text-xs text-theme-secondary mt-0.5">{m.note}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Aspect ratio */}
                    <div className="bg-card-theme border border-theme rounded-2xl p-5">
                        <label className="text-sm font-semibold text-theme-primary">Aspect ratio</label>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {ASPECTS.map((a) => (
                                <button
                                    key={a}
                                    onClick={() => setAspect(a)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${aspect === a
                                        ? 'bg-purple-600 text-white border-transparent'
                                        : 'bg-secondary border-theme text-theme-secondary hover:text-purple-500'
                                        }`}
                                >
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={onGenerate}
                        disabled={!!busy}
                        className="bg-purple-600 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-white font-bold disabled:opacity-50"
                    >
                        {busy === 'generate' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        {busy === 'generate' ? 'Generating…' : 'Generate'}
                    </button>
                </div>

                {/* Canvas / gallery */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-card-theme border border-theme rounded-2xl min-h-[420px] flex flex-col items-center justify-center text-center p-6">
                        {error && (
                            <p className="mb-4 w-full text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                {error}
                            </p>
                        )}
                        {latest ? (
                            <div className="w-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={latest.image} alt={latest.prompt} className="w-full rounded-xl border border-theme" />
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <p className="text-xs text-theme-secondary truncate">{latest.prompt}</p>
                                    <a
                                        href={latest.image}
                                        download="nyx-image.png"
                                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-500 flex-shrink-0"
                                    >
                                        <Download className="h-4 w-4" /> Save
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <ImageIcon className="h-8 w-8 text-purple-500" />
                                </div>
                                <p className="mt-5 text-theme-primary font-semibold">Your generations will appear here</p>
                                <p className="mt-1 text-sm text-theme-secondary max-w-sm">
                                    Pick a model, write or refine a prompt, and hit generate.
                                </p>
                            </>
                        )}
                    </div>

                    {/* Gallery */}
                    {results.length > 1 && (
                        <div className="grid grid-cols-3 gap-3">
                            {results.slice(1).map((r, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={r.image} alt={r.prompt} title={r.prompt} className="w-full aspect-square object-cover rounded-xl border border-theme" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
