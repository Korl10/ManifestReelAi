export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { customMusicSlots } from '@/lib/model-tiers';

// Returns a presigned URL so the client can upload a custom music track
// directly to cloud storage. Enforces the per-tier custom-music slot limit.
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
      return NextResponse.json({ error: `You’ve used all ${slots} custom music slot${slots > 1 ? 's' : ''}. Delete one to upload another.` }, { status: 403 });
    }

    const body = await request.json();
    const { fileName, contentType } = body ?? {};
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName and contentType are required' }, { status: 400 });
    }
    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(safeName, contentType, true);
    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (err) {
    console.error('Presign music error:', err);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
