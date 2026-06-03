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
  const usersWithSubs = await Promise.all(
    users.map(async (u: any) => {
      const sub = await prisma.subscription.findUnique({ where: { userId: u.id } });
      const reelCount = await prisma.reel.count({ where: { userId: u.id } });
      return { ...u, tier: sub?.tier ?? 'free', status: sub?.status ?? 'active', reelCount };
    })
  );
  return NextResponse.json(usersWithSubs);
}
