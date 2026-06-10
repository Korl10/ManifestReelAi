export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getTrackById } from '@/lib/music-library';
import { musicCapabilities } from '@/lib/model-tiers';
import { getCoinBalance } from '@/lib/quota';

/** List the current user's favorited track ids. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id as string;
  const rows = await prisma.musicFavorite.findMany({ where: { userId }, select: { trackId: true } });
  return NextResponse.json({ favorites: rows.map((r) => r.trackId) });
}

/** Favorite a track. Body: { trackId }. Premium+ only. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id as string;

  const quota = await getCoinBalance(userId).catch(() => null);
  const caps = musicCapabilities(quota?.tier, quota?.isTrialing);
  if (!caps.canFavorite) {
    return NextResponse.json({ error: 'Favorites are a Premium feature.', code: 'upgrade_required' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const trackId = String(body.trackId || '').trim();
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 });
  // Accept static-library ids and v2_<id> cloud ids.
  if (!getTrackById(trackId) && !trackId.startsWith('v2_')) {
    return NextResponse.json({ error: 'Unknown track' }, { status: 404 });
  }

  await prisma.musicFavorite.upsert({
    where: { userId_trackId: { userId, trackId } },
    update: {},
    create: { userId, trackId },
  });
  return NextResponse.json({ ok: true, trackId, favorited: true });
}

/** Unfavorite a track. Query: ?trackId= */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id as string;
  const { searchParams } = new URL(request.url);
  const trackId = String(searchParams.get('trackId') || '').trim();
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 });
  await prisma.musicFavorite.deleteMany({ where: { userId, trackId } });
  return NextResponse.json({ ok: true, trackId, favorited: false });
}
