export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { reelId, platform, scheduledAt } = body ?? {};
  if (!reelId) return NextResponse.json({ error: 'reelId required' }, { status: 400 });
  const userId = (session.user as any)?.id;
  const reel = await prisma.reel.findFirst({ where: { id: reelId, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
  await prisma.reel.update({
    where: { id: reelId },
    data: {
      status: 'scheduled',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      scheduledPlatform: platform ?? 'tiktok',
    },
  });
  return NextResponse.json({ success: true, message: 'Reel scheduled. Download and post manually or connect your social account for auto-posting.' });
}
