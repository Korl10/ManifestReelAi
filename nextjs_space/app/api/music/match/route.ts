export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { matchTrack, getAlternates, getTrackById } from '@/lib/music-library';

/**
 * Smart music matcher.
 *   GET /api/music/match?mood=&style=&platform=&exclude=id1,id2&trackId=
 * Returns the best instrumental match for the reel context plus 3 alternates
 * (powers the "Change track" button). If trackId is supplied it is honored as
 * the primary pick and alternates are computed around it.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const mood = searchParams.get('mood');
    const style = searchParams.get('style');
    const platform = searchParams.get('platform');
    const trackId = searchParams.get('trackId');
    const exclude = (searchParams.get('exclude') || '').split(',').map((s) => s.trim()).filter(Boolean);

    const query = { mood, style, platform, exclude };
    const primary = (trackId && getTrackById(trackId)) || matchTrack(query);
    // Alternates exclude the primary pick + any already-excluded ids.
    const altExclude = primary ? [...exclude, primary.id] : exclude;
    const alternates = getAlternates({ mood, style, platform, exclude: altExclude }, 3);

    return NextResponse.json({ track: primary, alternates });
  } catch (err) {
    console.error('Music match error:', err);
    return NextResponse.json({ error: 'Failed to match music' }, { status: 500 });
  }
}
