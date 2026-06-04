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
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    take: 100,
  });
  const userIds = users.map((u: any) => u.id);
  // Batch the related lookups into 2 queries instead of 2-per-user to avoid
  // exhausting the database connection pool.
  const [subs, reelGroups] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: { in: userIds } } }),
    prisma.reel.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
  ]);
  const subByUser = new Map(subs.map((s: any) => [s.userId, s]));
  const countByUser = new Map(reelGroups.map((g: any) => [g.userId, g._count._all]));
  const usersWithSubs = users.map((u: any) => {
    const sub: any = subByUser.get(u.id);
    return { ...u, tier: sub?.tier ?? 'free', status: sub?.status ?? 'active', reelCount: countByUser.get(u.id) ?? 0 };
  });
  return NextResponse.json(usersWithSubs);
}
