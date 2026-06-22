import OpenAI from 'openai';
import { generateWithGemini } from '@/lib/gemini';

// Hybrid text generation. Tries providers in order, falling back on failure or
// rate-limit. All free-tier first; OpenAI (paid) is the last resort.
//   1. Groq   (free, fast — Llama)        GROQ_API_KEY
//   2. Gemini (free tier)                 GEMINI_API_KEY
//   3. OpenAI (paid backup, gpt-4o-mini)  OPENAI_API_KEY

export type TextRequest = { system?: string; prompt: string; maxTokens?: number };

function chatMessages(req: TextRequest): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.prompt });
    return messages;
}

// Groq is OpenAI-API-compatible — reuse the OpenAI SDK with Groq's base URL.
async function viaGroq(req: TextRequest): Promise<string> {
    const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
    const res = await client.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        max_tokens: req.maxTokens ?? 1500,
        messages: chatMessages(req),
    });
    return res.choices[0]?.message?.content ?? '';
}

async function viaGemini(req: TextRequest): Promise<string> {
    const full = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;
    return generateWithGemini(full);
}

async function viaOpenAI(req: TextRequest): Promise<string> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: req.maxTokens ?? 1500,
        messages: chatMessages(req),
    });
    return res.choices[0]?.message?.content ?? '';
}

const CHAIN: Array<{ name: string; enabled: () => boolean; run: (r: TextRequest) => Promise<string> }> = [
    { name: 'groq', enabled: () => !!process.env.GROQ_API_KEY, run: viaGroq },
    { name: 'gemini', enabled: () => !!process.env.GEMINI_API_KEY, run: viaGemini },
    { name: 'openai', enabled: () => !!process.env.OPENAI_API_KEY, run: viaOpenAI },
];

export async function generateText(req: TextRequest): Promise<{ text: string; provider: string }> {
    const available = CHAIN.filter((p) => p.enabled());
    if (available.length === 0) {
        throw new Error('No text provider configured (set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY).');
    }
    let lastError: unknown = null;
    for (const p of available) {
        try {
            const text = (await p.run(req)).trim();
            if (text) return { text, provider: p.name };
            lastError = new Error(`${p.name} returned empty`);
        } catch (err) {
            lastError = err;
            console.warn(`[text] ${p.name} failed:`, err instanceof Error ? err.message : err);
        }
    }
    throw new Error(lastError instanceof Error ? lastError.message : 'All text providers failed.');
}
