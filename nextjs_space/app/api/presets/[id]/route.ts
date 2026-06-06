export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rowToPreset, sanitizePresetInput } from '@/lib/brand-presets-server';

async function owned(userId: string, id: string) {
  const row = await prisma.brandPreset.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return null;
  return row;
}

// GET /api/presets/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;
    const row = await owned(userId, params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ preset: rowToPreset(row) });
  } catch (err) {
    console.error('[presets] get error:', err);
    return NextResponse.json({ error: 'Failed to load preset' }, { status: 500 });
  }
}

// PATCH /api/presets/[id] — update preset fields.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;
    const row = await owned(userId, params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data = sanitizePresetInput(body);
    const updated = await prisma.brandPreset.update({ where: { id: params.id }, data });
    return NextResponse.json({ preset: rowToPreset(updated) });
  } catch (err) {
    console.error('[presets] update error:', err);
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 });
  }
}

// DELETE /api/presets/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;
    const row = await owned(userId, params.id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.brandPreset.delete({ where: { id: params.id } });
    // If we deleted the default, promote the most-recently-updated remaining one.
    if (row.isDefault) {
      const next = await prisma.brandPreset.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
      if (next) await prisma.brandPreset.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[presets] delete error:', err);
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
  }
}
