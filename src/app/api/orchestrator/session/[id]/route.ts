import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';

export const runtime = 'nodejs';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET details of a single session (including references and messages)
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await prisma.orchestratorSession.findUnique({
            where: { id },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                references: { orderBy: { createdAt: 'desc' } }
            }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, session });
    } catch (error: unknown) {
        console.error('[Orchestrator Session Detail GET Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to retrieve session details' },
            { status: 500 }
        );
    }
}

// PATCH update session details (name, systemPrompt)
export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const { name, systemPrompt } = await request.json().catch(() => ({}));

        const data: Record<string, string> = {};
        if (name !== undefined) data.name = name.trim();
        if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;

        const session = await prisma.orchestratorSession.update({
            where: { id },
            data
        });

        return NextResponse.json({ success: true, session });
    } catch (error: unknown) {
        console.error('[Orchestrator Session Detail PATCH Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update session details' },
            { status: 500 }
        );
    }
}

// DELETE a session (cascade deletes messages and references)
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        await prisma.orchestratorSession.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Session deleted successfully' });
    } catch (error: unknown) {
        console.error('[Orchestrator Session Detail DELETE Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete session' },
            { status: 500 }
        );
    }
}
