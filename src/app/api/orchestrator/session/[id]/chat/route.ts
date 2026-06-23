import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';
import { generateText } from '@/lib/llm/text';

export const runtime = 'nodejs';
// Give the orchestrator chat ample time to complete
export const maxDuration = 60;

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const { message } = await request.json().catch(() => ({}));

        if (!message || !message.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Fetch session along with active references and existing messages
        const session = await prisma.orchestratorSession.findUnique({
            where: { id },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                references: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Save user's message to the database
        const userMsg = await prisma.orchestratorMessage.create({
            data: {
                sessionId: id,
                role: 'user',
                content: message.trim()
            }
        });

        // 1. Build the system instructions containing locked references
        let referencesContext = '';
        if (session.references.length > 0) {
            referencesContext = '\n\n--- LOCKED REFERENCE MATERIALS (Strictly Adhere to these details) ---\n';
            session.references.forEach((ref) => {
                referencesContext += `\n[Reference name: ${ref.name}]\n${ref.content}\n-----------------------------\n`;
            });
            referencesContext += '\n--- END OF REFERENCE MATERIALS ---';
        }

        const baseSystem = session.systemPrompt || 'You are an advanced AI Creative Orchestrator. Help the user design and refine their copy, scripts, and brand assets.';
        const systemPrompt = `${baseSystem}${referencesContext}\n\nMaintain maximum context consistency. Address references explicitly if the user's prompt queries them. Respond in standard markdown format.`;

        // 2. Build full conversation history context
        // We include all existing messages in the session up to this point
        const historyPrompt = session.messages.length > 0
            ? `\nPrevious conversation:\n${session.messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\n`
            : '';

        const fullPrompt = `${historyPrompt}User: ${message.trim()}\nAssistant:`;

        // 3. Trigger the LLM generator
        const { text, provider } = await generateText({
            system: systemPrompt,
            prompt: fullPrompt,
            maxTokens: 2000
        });

        // 4. Save AI's response to the database
        const assistantMsg = await prisma.orchestratorMessage.create({
            data: {
                sessionId: id,
                role: 'assistant',
                content: text
            }
        });

        return NextResponse.json({
            success: true,
            data: text,
            provider,
            messages: [userMsg, assistantMsg]
        });

    } catch (error: unknown) {
        console.error('[Orchestrator Chat POST Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process chat' },
            { status: 500 }
        );
    }
}
