'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Sparkles,
    Send,
    Plus,
    Trash2,
    Lock,
    Unlock,
    FileText,
    Settings,
    ChevronRight,
    Loader2,
    MessageSquare,
    CheckCircle,
    User,
    Bot
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import NyxButton from '@/components/ui/NyxButton';

interface Session {
    id: string;
    name: string;
    systemPrompt: string | null;
    createdAt: string;
    _count?: { messages: number; references: number };
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

interface Reference {
    id: string;
    name: string;
    content: string;
    isActive: boolean;
}

const STOCK_PROMPTS = [
    {
        name: 'Creative Partner',
        prompt: 'You are an advanced AI Creative Orchestrator. Help the user design and refine their copy, scripts, and brand assets while strictly adhering to the locked references.',
        desc: 'Standard creative assistant'
    },
    {
        name: 'Viral Hook Optimizer',
        prompt: 'You are a TikTok/Shorts hooks expert. Rewrite the user\'s script hooks to maximize audience retention and engagement in the first 3 seconds.',
        desc: 'Focuses on 3s hooks'
    },
    {
        name: 'Sales Pitch Builder',
        prompt: 'You are a master copywriter and sales strategist. Refine the user\'s copy to convert readers into buyers, focusing on strong benefits and high-converting CTAs.',
        desc: 'Focuses on conversions & CTAs'
    },
    {
        name: 'Brand Voice Align',
        prompt: 'You are a brand identity specialist. Ensure the generated copy matches the target audience, tone of voice, and brand values outlined in the reference documents.',
        desc: 'Enforces brand consistency'
    }
];

export default function OrchestratorPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [references, setReferences] = useState<Reference[]>([]);
    
    // Loading/busy states
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [sendingChat, setSendingChat] = useState(false);
    
    // Inputs
    const [newSessionName, setNewSessionName] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [newRefName, setNewRefName] = useState('');
    const [newRefContent, setNewRefContent] = useState('');
    const [customSystemPrompt, setCustomSystemPrompt] = useState('');
    
    // Toggle tabs/modals
    const [showPromptSettings, setShowPromptSettings] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [providerUsed, setProviderUsed] = useState<string | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sendingChat]);

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
    }, []);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const loadSessions = async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch('/api/orchestrator/session');
            const data = await res.json();
            if (data.success) {
                setSessions(data.sessions || []);
                // Default to first session if none active
                if (data.sessions?.length > 0 && !activeSession) {
                    selectSession(data.sessions[0]);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSessions(false);
        }
    };

    const selectSession = async (session: Session) => {
        setLoadingDetails(true);
        setActiveSession(session);
        setCustomSystemPrompt(session.systemPrompt || '');
        try {
            const res = await fetch(`/api/orchestrator/session/${session.id}`);
            const data = await res.json();
            if (data.success && data.session) {
                setMessages(data.session.messages || []);
                setReferences(data.session.references || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const createSession = async () => {
        const name = newSessionName.trim() || `Session ${sessions.length + 1}`;
        try {
            const res = await fetch('/api/orchestrator/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (data.success) {
                setNewSessionName('');
                await loadSessions();
                selectSession(data.session);
                showToast('Chat Session Created!');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this session?')) return;
        try {
            await fetch(`/api/orchestrator/session/${id}`, { method: 'DELETE' });
            if (activeSession?.id === id) {
                setActiveSession(null);
                setMessages([]);
                setReferences([]);
            }
            await loadSessions();
            showToast('Session deleted');
        } catch (err) {
            console.error(err);
        }
    };

    const updateSystemPrompt = async (promptText: string) => {
        if (!activeSession) return;
        try {
            const res = await fetch(`/api/orchestrator/session/${activeSession.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt: promptText })
            });
            const data = await res.json();
            if (data.success) {
                setActiveSession(data.session);
                setCustomSystemPrompt(data.session.systemPrompt || '');
                showToast('Prompt Template Applied!');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const addReference = async () => {
        if (!activeSession || !newRefName.trim() || !newRefContent.trim()) return;
        try {
            const res = await fetch(`/api/orchestrator/session/${activeSession.id}/reference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newRefName, content: newRefContent })
            });
            const data = await res.json();
            if (data.success) {
                setReferences(prev => [data.reference, ...prev]);
                setNewRefName('');
                setNewRefContent('');
                showToast('Reference Guideline Locked Into Context!');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleReference = async (ref: Reference) => {
        if (!activeSession) return;
        try {
            const nextStatus = !ref.isActive;
            const res = await fetch(`/api/orchestrator/session/${activeSession.id}/reference`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ referenceId: ref.id, isActive: nextStatus })
            });
            const data = await res.json();
            if (data.success) {
                setReferences(prev =>
                    prev.map(r => r.id === ref.id ? { ...r, isActive: nextStatus } : r)
                );
                showToast(nextStatus ? 'Reference Locked!' : 'Reference Unlocked');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const removeReference = async (refId: string) => {
        if (!activeSession) return;
        if (!confirm('Remove this reference?')) return;
        try {
            const res = await fetch(`/api/orchestrator/session/${activeSession.id}/reference?referenceId=${refId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setReferences(prev => prev.filter(r => r.id !== refId));
                showToast('Reference removed');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const sendChatMessage = async () => {
        const text = chatInput.trim();
        if (!text || !activeSession || sendingChat) return;

        setSendingChat(true);
        setChatInput('');
        setProviderUsed(null);

        // Optimistically add user message
        const mockUserMsg: Message = {
            id: `temp-u-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, mockUserMsg]);

        try {
            const res = await fetch(`/api/orchestrator/session/${activeSession.id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev =>
                    prev.filter(m => !m.id.startsWith('temp-')).concat(data.messages)
                );
                setProviderUsed(data.provider);
            } else {
                setMessages(prev =>
                    prev.filter(m => !m.id.startsWith('temp-')).concat([{
                        id: `temp-err-${Date.now()}`,
                        role: 'assistant',
                        content: data.error || 'Chat execution failed.',
                        createdAt: new Date().toISOString()
                    }])
                );
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSendingChat(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    };

    return (
        <div className="space-y-6 min-h-screen">
            {toast && (
                <div className="fixed top-24 right-8 bg-purple-600 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-fade-in border border-purple-500/20 font-semibold text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" /> {toast}
                </div>
            )}

            <PageHeader
                index="08"
                kicker="Context & Reference Engine"
                title="AI Orchestrator"
                subtitle="Preserve context across infinite chats. Upload reference style sheets and lock them into context."
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                
                {/* 1. Left Sidebar: Channels */}
                <div className="lg:col-span-1 bg-card-theme border border-theme rounded-2xl p-4 flex flex-col h-[700px]">
                    <h3 className="font-bold text-xs uppercase tracking-widest text-theme-secondary mb-3">Chat Channels</h3>
                    
                    {/* Add Session Input */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="New chat name..."
                            value={newSessionName}
                            onChange={(e) => setNewSessionName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && createSession()}
                            className="flex-1 bg-secondary border border-theme rounded-xl px-3 py-2 text-xs text-theme-primary placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                        />
                        <button
                            onClick={createSession}
                            className="bg-purple-600 hover:bg-purple-700 transition-colors text-white p-2 rounded-xl"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Session List */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
                        {loadingSessions ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <p className="text-xs text-theme-secondary text-center py-8">No channels created.</p>
                        ) : (
                            sessions.map((s) => {
                                const isActive = activeSession?.id === s.id;
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => selectSession(s)}
                                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${
                                            isActive
                                                ? 'bg-purple-600 border-transparent text-white shadow-lg'
                                                : 'bg-secondary/40 border-theme text-theme-secondary hover:bg-secondary/80 hover:text-theme-primary'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                            <MessageSquare className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-500'}`} />
                                            <span className="truncate text-xs font-semibold">{s.name}</span>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(s.id, e)}
                                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 ${
                                                isActive ? 'text-white/80 hover:text-white' : 'text-theme-secondary hover:text-red-400'
                                            }`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. Middle Panel: Presets & Reference Assets */}
                <div className="lg:col-span-1 bg-card-theme border border-theme rounded-2xl p-4 flex flex-col h-[700px] overflow-y-auto">
                    <h3 className="font-bold text-xs uppercase tracking-widest text-theme-secondary mb-3">Context Guidelines</h3>
                    
                    {/* Active Session Configuration */}
                    {activeSession ? (
                        <div className="space-y-5">
                            {/* Stock Prompts Preset Library */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-theme-secondary mb-2">Prompt Recipe Preset</label>
                                <div className="space-y-1.5">
                                    {STOCK_PROMPTS.map((sp) => {
                                        const isApplied = activeSession.systemPrompt === sp.prompt;
                                        return (
                                            <div
                                                key={sp.name}
                                                onClick={() => updateSystemPrompt(sp.prompt)}
                                                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:border-purple-500/50 ${
                                                    isApplied
                                                        ? 'bg-purple-600/10 border-purple-500 text-purple-400'
                                                        : 'bg-secondary/40 border-theme text-theme-secondary'
                                                }`}
                                            >
                                                <p className="text-xs font-bold">{sp.name}</p>
                                                <p className="text-[10px] opacity-75 mt-0.5">{sp.desc}</p>
                                            </div>
                                        );
                                    })}
                                    <button
                                        onClick={() => setShowPromptSettings(!showPromptSettings)}
                                        className="w-full flex items-center justify-between p-2.5 bg-secondary/40 border border-theme hover:border-purple-500/30 text-theme-secondary text-xs rounded-xl transition-all"
                                    >
                                        <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Custom Instructions</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Custom prompt settings editor */}
                            {showPromptSettings && (
                                <div className="p-3 border border-theme rounded-xl space-y-2 bg-secondary/20">
                                    <label className="block text-[9px] font-bold uppercase tracking-wider text-theme-secondary">System Prompt</label>
                                    <textarea
                                        value={customSystemPrompt}
                                        onChange={(e) => setCustomSystemPrompt(e.target.value)}
                                        rows={4}
                                        placeholder="Customize orchestrator commands..."
                                        className="w-full bg-secondary border border-theme rounded-lg p-2 text-xs text-theme-primary placeholder-gray-500 focus:outline-none focus:border-purple-500/30 resize-none font-mono"
                                    />
                                    <NyxButton
                                        onClick={() => updateSystemPrompt(customSystemPrompt)}
                                        className="w-full py-1 text-[10px] justify-center"
                                    >
                                        Save Custom Prompt
                                    </NyxButton>
                                </div>
                            )}

                            <hr className="border-theme" />

                            {/* Reference Lock Manager */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-theme-secondary">Locked References</label>
                                    <span className="text-[10px] bg-purple-600/10 border border-purple-500/30 text-purple-400 rounded-full px-2 py-0.5 font-bold">
                                        {references.filter(r => r.isActive).length} Locked
                                    </span>
                                </div>

                                {/* Form to add new reference text */}
                                <div className="border border-theme rounded-xl p-3 bg-secondary/20 space-y-2.5">
                                    <input
                                        type="text"
                                        placeholder="e.g. Brand Guidelines, Audience Style"
                                        value={newRefName}
                                        onChange={(e) => setNewRefName(e.target.value)}
                                        className="w-full bg-secondary border border-theme rounded-lg px-2 py-1.5 text-xs text-theme-primary focus:outline-none"
                                    />
                                    <textarea
                                        placeholder="Copy-paste reference guidelines, colors, rules..."
                                        value={newRefContent}
                                        onChange={(e) => setNewRefContent(e.target.value)}
                                        rows={4}
                                        className="w-full bg-secondary border border-theme rounded-lg p-2 text-xs text-theme-primary focus:outline-none resize-none"
                                    />
                                    <NyxButton
                                        onClick={addReference}
                                        disabled={!newRefName.trim() || !newRefContent.trim()}
                                        className="w-full py-1.5 text-xs justify-center"
                                    >
                                        Lock Guideline
                                    </NyxButton>
                                </div>

                                {/* References List */}
                                <div className="space-y-1.5">
                                    {references.map((ref) => (
                                        <div key={ref.id} className="bg-secondary/40 border border-theme rounded-xl p-2.5 flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-theme-primary truncate">{ref.name}</p>
                                                <p className="text-[10px] text-theme-secondary line-clamp-1 mt-0.5">{ref.content}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => toggleReference(ref)}
                                                    className={`p-1 rounded border transition-colors ${
                                                        ref.isActive
                                                            ? 'bg-purple-600/10 border-purple-500 text-purple-400'
                                                            : 'bg-secondary border-theme text-theme-secondary'
                                                    }`}
                                                    title={ref.isActive ? 'Locked (Injected in Context)' : 'Unlocked'}
                                                >
                                                    {ref.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                </button>
                                                <button
                                                    onClick={() => removeReference(ref.id)}
                                                    className="p-1 rounded hover:bg-red-500/10 text-theme-secondary hover:text-red-400"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-theme-secondary text-center py-12">Select or create a channel to configure guidelines.</p>
                    )}
                </div>

                {/* 3. Main Chat Panel */}
                <div className="lg:col-span-2 bg-card-theme border border-theme rounded-2xl flex flex-col h-[700px]">
                    {activeSession ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-5 py-4 border-b border-theme flex items-center justify-between bg-secondary/20">
                                <div>
                                    <h4 className="text-sm font-bold text-theme-primary">{activeSession.name}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-theme-secondary flex items-center gap-1">
                                            <FileText className="w-3 h-3 text-purple-500" /> {references.filter(r => r.isActive).length} active reference locks
                                        </span>
                                    </div>
                                </div>
                                {providerUsed && (
                                    <span className="text-[9px] uppercase tracking-wider text-purple-400 bg-purple-600/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-semibold">
                                        Powered by {providerUsed}
                                    </span>
                                )}
                            </div>

                            {/* Chat History Canvas */}
                            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scrollbar-thin">
                                {loadingDetails ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto space-y-3">
                                        <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
                                        <h5 className="font-bold text-theme-primary text-sm uppercase tracking-wider">Empty Canvas</h5>
                                        <p className="text-xs text-theme-secondary">
                                            All references locked in the sidebar are injected directly with every message. Write a prompt to begin orchestration.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((m) => {
                                        const isUser = m.role === 'user';
                                        return (
                                            <div
                                                key={m.id}
                                                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                                            >
                                                {!isUser && (
                                                    <div className="w-8 h-8 rounded-full border border-theme bg-secondary flex items-center justify-center shrink-0">
                                                        <Bot className="w-4 h-4 text-purple-500" />
                                                    </div>
                                                )}
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 border text-sm leading-relaxed shadow-sm ${
                                                    isUser
                                                        ? 'bg-purple-600 border-transparent text-white rounded-tr-none'
                                                        : 'bg-secondary/40 border-theme text-theme-primary rounded-tl-none whitespace-pre-wrap'
                                                }`}>
                                                    {m.content}
                                                </div>
                                                {isUser && (
                                                    <div className="w-8 h-8 rounded-full border border-theme bg-purple-600/10 flex items-center justify-center shrink-0">
                                                        <User className="w-4 h-4 text-purple-500" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                                
                                {sendingChat && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full border border-theme bg-secondary flex items-center justify-center shrink-0">
                                            <Bot className="w-4 h-4 text-purple-500 animate-pulse" />
                                        </div>
                                        <div className="bg-secondary/40 border border-theme px-4 py-3 rounded-2xl rounded-tl-none">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Composer */}
                            <div className="px-5 py-4 border-t border-theme bg-secondary/10">
                                <div className="flex items-end gap-3">
                                    <textarea
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={`Send message to ${activeSession.name}... (References will be injected)`}
                                        rows={1}
                                        className="flex-1 bg-secondary border border-theme rounded-xl px-4 py-3 text-sm text-theme-primary placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none max-h-32 min-h-[44px] leading-relaxed transition-colors"
                                    />
                                    <button
                                        onClick={sendChatMessage}
                                        disabled={!chatInput.trim() || sendingChat}
                                        className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <MessageSquare className="w-12 h-12 text-theme-secondary/40 mb-3" />
                            <h4 className="font-bold text-theme-primary text-sm uppercase tracking-wider">No Active Canvas</h4>
                            <p className="text-xs text-theme-secondary mt-1">Select or create a chat channel on the left to start orchestrating.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
