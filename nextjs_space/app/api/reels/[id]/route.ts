export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveReelAssets, isPlaceholderUrl, getVoiceSample } from '@/lib/reel-assets';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });

  // Backfill real, playable media for reels created before the media pipeline
  // was wired up (or that still reference placeholder paths).
  const assets = resolveReelAssets({ style: reel.style, mood: reel.mood, voice: reel.voice });
  const resolved = {
    ...reel,
    videoUrl: isPlaceholderUrl(reel.videoUrl) ? assets.videoUrl : reel.videoUrl,
    musicUrl: isPlaceholderUrl(reel.musicUrl) ? assets.musicUrl : reel.musicUrl,
    thumbnailUrl: isPlaceholderUrl(reel.thumbnailUrl) ? assets.posterUrl : reel.thumbnailUrl,
    audioUrl: isPlaceholderUrl(reel.audioUrl) ? assets.voiceSampleUrl : reel.audioUrl,
    // Prefer the REAL poster frame extracted from the rendered MP4; only fall
    // back to the generic style template when the reel has no real thumbnail.
    posterUrl: isPlaceholderUrl(reel.thumbnailUrl) ? assets.posterUrl : reel.thumbnailUrl,
    voiceSampleUrl: getVoiceSample(reel.voice),
  };
  return NextResponse.json(resolved);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { caption, description, hashtags, title } = body ?? {};
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
  const updated = await prisma.reel.update({
    where: { id: params.id },
    data: {
      ...(caption !== undefined && { caption }),
      ...(description !== undefined && { description }),
      ...(hashtags !== undefined && { hashtags }),
      ...(title !== undefined && { title }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
  await prisma.reel.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
