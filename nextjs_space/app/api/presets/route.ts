export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { brandPresetLimit, isUnlimited, presetLimitLabel } from '@/lib/brand-presets';
import { rowToPreset, sanitizePresetInput } from '@/lib/brand-presets-server';

async function getTier(userId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub?.tier ?? 'free';
}

// GET /api/presets — list the current user's brand presets + tier limit info.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const [rows, tier] = await Promise.all([
      prisma.brandPreset.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      }),
      getTier(userId),
    ]);
    const limit = brandPresetLimit(tier);
    return NextResponse.json({
      presets: rows.map(rowToPreset),
      tier,
      limit,
      unlimited: isUnlimited(limit),
      used: rows.length,
      canCreate: isUnlimited(limit) || rows.length < limit,
      limitLabel: presetLimitLabel(tier),
    });
  } catch (err) {
    console.error('[presets] list error:', err);
    return NextResponse.json({ error: 'Failed to load presets' }, { status: 500 });
  }
}

// POST /api/presets — create a new preset (tier-gated).
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const tier = await getTier(userId);
    const limit = brandPresetLimit(tier);
    const count = await prisma.brandPreset.count({ where: { userId } });
    if (!isUnlimited(limit) && count >= limit) {
      return NextResponse.json(
        {
          error: limit === 0
            ? 'Brand presets are a paid feature. Upgrade to start saving on-brand presets.'
            : `Your plan includes ${presetLimitLabel(tier)}. Upgrade for more.`,
          reason: 'preset_limit',
          limit,
          tier,
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const data = sanitizePresetInput(body);
    const makeDefault = body?.isDefault === true || count === 0; // first preset is default

    const created = await prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.brandPreset.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.brandPreset.create({ data: { ...data, userId, isDefault: makeDefault } });
    });
    return NextResponse.json({ preset: rowToPreset(created) }, { status: 201 });
  } catch (err) {
    console.error('[presets] create error:', err);
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 });
  }
}
