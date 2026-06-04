export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';

// List the signed-in user's custom voices (with playable URLs)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const voices = await prisma.customVoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const withUrls = await Promise.all(
      voices.map(async (v) => ({
        id: v.id,
        name: v.name,
        source: v.source,
        createdAt: v.createdAt,
        audio: await getFileUrl(v.cloudStoragePath, v.isPublic),
      }))
    );
    return NextResponse.json(withUrls);
  } catch (err) {
    console.error('List custom voices error:', err);
    return NextResponse.json({ error: 'Failed to load voices' }, { status: 500 });
  }
}

// Save a custom voice record after the file has been uploaded to cloud storage
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const body = await request.json();
    const { name, cloud_storage_path, durationSec, source } = body ?? {};
    if (!name || !cloud_storage_path) {
      return NextResponse.json({ error: 'name and cloud_storage_path are required' }, { status: 400 });
    }

    const voice = await prisma.customVoice.create({
      data: {
        userId,
        name: String(name).slice(0, 60),
        cloudStoragePath: cloud_storage_path,
        isPublic: true,
        durationSec: typeof durationSec === 'number' ? durationSec : null,
        source: source === 'record' ? 'record' : 'upload',
      },
    });

    const audio = await getFileUrl(voice.cloudStoragePath, voice.isPublic);
    return NextResponse.json({ id: voice.id, name: voice.name, source: voice.source, audio }, { status: 201 });
  } catch (err) {
    console.error('Create custom voice error:', err);
    return NextResponse.json({ error: 'Failed to save voice' }, { status: 500 });
  }
}
