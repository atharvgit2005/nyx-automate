import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';

export const runtime = 'nodejs';

// GET all sessions ordered by creation date
export async function GET() {
    try {
        const sessions = await prisma.orchestratorSession.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { messages: true, references: true }
                }
            }
        });
        return NextResponse.json({ success: true, sessions });
    } catch (error: unknown) {
        console.error('[Orchestrator Session GET Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to retrieve sessions' },
            { status: 500 }
        );
    }
}

// POST create a new session
export async function POST(request: Request) {
    try {
        const { name } = await request.json().catch(() => ({}));
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
        }

        const session = await prisma.orchestratorSession.create({
            data: {
                name: name.trim(),
                systemPrompt: 'You are an advanced AI Creative Orchestrator. Help the user design and refine their copy, scripts, and brand assets while strictly adhering to the attached reference guidelines.'
            }
        });

        return NextResponse.json({ success: true, session });
    } catch (error: unknown) {
        console.error('[Orchestrator Session POST Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create session' },
            { status: 500 }
        );
    }
}
