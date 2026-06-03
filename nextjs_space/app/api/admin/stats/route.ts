export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const [totalUsers, totalReels, totalSubs] = await Promise.all([
    prisma.user.count(),
    prisma.reel.count(),
    prisma.subscription.count(),
  ]);
  const reelsByTier = await prisma.subscription.groupBy({ by: ['tier'], _count: { tier: true } });
  const reelsByStatus = await prisma.reel.groupBy({ by: ['status'], _count: { status: true } });
  const allReels = await prisma.reel.findMany({ select: { totalCost: true, createdAt: true } });
  const totalCost = allReels.reduce((s: number, r: any) => s + (r?.totalCost ?? 0), 0);

  return NextResponse.json({
    totalUsers,
    totalReels,
    totalSubscriptions: totalSubs,
    reelsByTier: reelsByTier?.map((r: any) => ({ tier: r.tier, count: r._count?.tier ?? 0 })) ?? [],
    reelsByStatus: reelsByStatus?.map((r: any) => ({ status: r.status, count: r._count?.status ?? 0 })) ?? [],
    totalCost: Math.round(totalCost * 100) / 100,
    avgCostPerReel: totalReels > 0 ? Math.round((totalCost / totalReels) * 100) / 100 : 0,
  });
}
