import { NextResponse } from 'next/server';
import prisma from '@/lib/prismadb';

export const runtime = 'nodejs';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST create a new reference material for a session
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const { name, content } = await request.json().catch(() => ({}));

        if (!name || !name.trim() || !content || !content.trim()) {
            return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
        }

        const reference = await prisma.orchestratorReference.create({
            data: {
                sessionId: id,
                name: name.trim(),
                content: content.trim(),
                isActive: true
            }
        });

        return NextResponse.json({ success: true, reference });
    } catch (error: unknown) {
        console.error('[Orchestrator Reference POST Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to add reference' },
            { status: 500 }
        );
    }
}

// PATCH toggle reference's active status (lock/unlock from context)
export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { referenceId, isActive } = await request.json().catch(() => ({}));
        if (!referenceId) {
            return NextResponse.json({ error: 'Reference ID is required' }, { status: 400 });
        }

        const reference = await prisma.orchestratorReference.update({
            where: { id: referenceId },
            data: { isActive: Boolean(isActive) }
        });

        return NextResponse.json({ success: true, reference });
    } catch (error: unknown) {
        console.error('[Orchestrator Reference PATCH Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update reference' },
            { status: 500 }
        );
    }
}

// DELETE a reference material
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const referenceId = searchParams.get('referenceId');

        if (!referenceId) {
            return NextResponse.json({ error: 'Reference ID is required' }, { status: 400 });
        }

        await prisma.orchestratorReference.delete({
            where: { id: referenceId }
        });

        return NextResponse.json({ success: true, message: 'Reference deleted' });
    } catch (error: unknown) {
        console.error('[Orchestrator Reference DELETE Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete reference' },
            { status: 500 }
        );
    }
}
