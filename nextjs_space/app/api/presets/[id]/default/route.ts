export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// POST /api/presets/[id]/default — pin this preset as the user's default.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;
    const row = await prisma.brandPreset.findUnique({ where: { id: params.id } });
    if (!row || row.userId !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.$transaction([
      prisma.brandPreset.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      prisma.brandPreset.update({ where: { id: params.id }, data: { isDefault: true } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[presets] set-default error:', err);
    return NextResponse.json({ error: 'Failed to set default preset' }, { status: 500 });
  }
}
