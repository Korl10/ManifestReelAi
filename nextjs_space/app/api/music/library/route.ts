export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rankTracksAsync, type MusicTrack } from '@/lib/music-library';
import { musicCapabilities } from '@/lib/model-tiers';
import { getCoinBalance } from '@/lib/quota';

/**
 * Full music-library browse endpoint (Phase 3).
 *   GET /api/music/library?mood=&style=&platform=
 * Returns:
 *   - suggested: top 5 AI-matched background tracks for the reel context
 *   - tracks:    the full background library, sorted (matched-first → energy → title)
 *   - favorites: trackIds the current user has favorited (Premium+)
 *   - capabilities: what this user's tier can do (browse/regenerate/favorite/bulk)
 * Access to the full list is gated client-side; the data is always returned so
 * the locked-state UI can preview blurred cards.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any).id as string;

    const { searchParams } = new URL(request.url);
    const mood = searchParams.get('mood');
    const style = searchParams.get('style');
    const platform = searchParams.get('platform');

    const ranked = await rankTracksAsync({ mood, style, platform });
    const suggestedIds = new Set(ranked.slice(0, 5).map((r) => r.track.id));

    const ENERGY_RANK: Record<string, number> = { 'very-high': 5, high: 4, 'mid-high': 3, mid: 2, low: 1 };
    // Sort: matched (suggested) first by score, then by energy desc, then title.
    const tracks: MusicTrack[] = ranked
      .map((r) => ({ ...r.track, _score: r.score }))
      .sort((a, b) => {
        const aS = suggestedIds.has(a.id) ? 1 : 0;
        const bS = suggestedIds.has(b.id) ? 1 : 0;
        if (aS !== bS) return bS - aS;
        if (aS && bS) return (b as any)._score - (a as any)._score;
        const eDiff = (ENERGY_RANK[b.energy] ?? 0) - (ENERGY_RANK[a.energy] ?? 0);
        if (eDiff !== 0) return eDiff;
        return a.title.localeCompare(b.title);
      })
      .map(({ _score, ...t }: any) => t);

    const suggested = ranked.slice(0, 5).map((r) => r.track);

    const quota = await getCoinBalance(userId).catch(() => null);
    const caps = musicCapabilities(quota?.tier, quota?.isTrialing);

    let favorites: string[] = [];
    if (caps.canFavorite) {
      const rows = await prisma.musicFavorite.findMany({ where: { userId }, select: { trackId: true } });
      favorites = rows.map((r) => r.trackId);
    }

    return NextResponse.json({
      mood: mood ?? null,
      suggested,
      tracks,
      favorites,
      capabilities: caps,
    });
  } catch (err) {
    console.error('Music library error:', err);
    return NextResponse.json({ error: 'Failed to load music library' }, { status: 500 });
  }
}
