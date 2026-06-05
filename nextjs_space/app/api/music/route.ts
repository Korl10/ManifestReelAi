export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';
import { customMusicSlots } from '@/lib/model-tiers';

// List the signed-in user's custom music tracks (with playable URLs) + slot info.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const tier = sub?.tier ?? 'free';
    const slots = customMusicSlots(tier);

    const tracks = await prisma.customMusic.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const withUrls = await Promise.all(
      tracks.map(async (t) => ({
        id: t.id,
        name: t.name,
        source: t.source,
        durationSec: t.durationSec,
        createdAt: t.createdAt,
        audio: await getFileUrl(t.cloudStoragePath, t.isPublic),
      }))
    );
    return NextResponse.json({ tracks: withUrls, slots, used: tracks.length });
  } catch (err) {
    console.error('List custom music error:', err);
    return NextResponse.json({ error: 'Failed to load music' }, { status: 500 });
  }
}

// Save a custom music record after the file is uploaded to cloud storage.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const tier = sub?.tier ?? 'free';
    const slots = customMusicSlots(tier);
    if (slots <= 0) {
      return NextResponse.json({ error: 'Custom music uploads are available on Pro and Premium plans.' }, { status: 403 });
    }
    const used = await prisma.customMusic.count({ where: { userId } });
    if (used >= slots) {
      return NextResponse.json({ error: `You’ve used all ${slots} custom music slot${slots > 1 ? 's' : ''}.` }, { status: 403 });
    }

    const body = await request.json();
    const { name, cloud_storage_path, durationSec } = body ?? {};
    if (!name || !cloud_storage_path) {
      return NextResponse.json({ error: 'name and cloud_storage_path are required' }, { status: 400 });
    }

    const track = await prisma.customMusic.create({
      data: {
        userId,
        name: String(name).slice(0, 60),
        cloudStoragePath: cloud_storage_path,
        isPublic: true,
        durationSec: typeof durationSec === 'number' ? durationSec : null,
        source: 'upload',
      },
    });
    const audio = await getFileUrl(track.cloudStoragePath, track.isPublic);
    return NextResponse.json({ id: track.id, name: track.name, durationSec: track.durationSec, audio }, { status: 201 });
  } catch (err) {
    console.error('Create custom music error:', err);
    return NextResponse.json({ error: 'Failed to save music' }, { status: 500 });
  }
}
