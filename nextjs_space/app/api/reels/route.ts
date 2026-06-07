export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveReelAssets, isPlaceholderUrl } from '@/lib/reel-assets';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const reels = await prisma.reel.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  // Resolve a usable card thumbnail for each reel: prefer the REAL poster frame
  // (extracted from the rendered MP4); fall back to the generic style poster
  // only when the reel has no real thumbnail yet.
  const resolved = reels.map((reel) => {
    const assets = resolveReelAssets({ style: reel.style, mood: reel.mood, voice: reel.voice });
    return {
      ...reel,
      thumbnailUrl: isPlaceholderUrl(reel.thumbnailUrl) ? assets.posterUrl : reel.thumbnailUrl,
    };
  });
  return NextResponse.json(resolved);
}
