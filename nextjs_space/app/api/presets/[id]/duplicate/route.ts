export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { brandPresetLimit, isUnlimited, presetLimitLabel } from '@/lib/brand-presets';
import { rowToPreset } from '@/lib/brand-presets-server';

// POST /api/presets/[id]/duplicate — clone a preset (tier-gated, never default).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const src = await prisma.brandPreset.findUnique({ where: { id: params.id } });
    if (!src || src.userId !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const tier = sub?.tier ?? 'free';
    const limit = brandPresetLimit(tier);
    const count = await prisma.brandPreset.count({ where: { userId } });
    if (!isUnlimited(limit) && count >= limit) {
      return NextResponse.json(
        { error: `Your plan includes ${presetLimitLabel(tier)}. Upgrade for more.`, reason: 'preset_limit', limit, tier },
        { status: 403 },
      );
    }

    const { id, createdAt, updatedAt, usageCount, isDefault, name, ...rest } = src as any;
    const copy = await prisma.brandPreset.create({
      data: { ...rest, userId, name: `${name} (Copy)`.slice(0, 60), isDefault: false, usageCount: 0 },
    });
    return NextResponse.json({ preset: rowToPreset(copy) }, { status: 201 });
  } catch (err) {
    console.error('[presets] duplicate error:', err);
    return NextResponse.json({ error: 'Failed to duplicate preset' }, { status: 500 });
  }
}
