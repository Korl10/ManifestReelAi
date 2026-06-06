export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generatePresignedUploadUrl, getPublicUrl } from '@/lib/s3';
import { brandPresetLimit } from '@/lib/brand-presets';

const ALLOWED = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];

// POST /api/presets/presign — presigned URL for uploading a brand logo.
// Gated to paid tiers (anyone who can own a preset).
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const tier = sub?.tier ?? 'free';
    if (brandPresetLimit(tier) === 0) {
      return NextResponse.json({ error: 'Brand presets are a paid feature. Upgrade to unlock.' }, { status: 403 });
    }

    const body = await request.json();
    const { fileName, contentType } = body ?? {};
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName and contentType are required' }, { status: 400 });
    }
    if (!ALLOWED.includes(String(contentType))) {
      return NextResponse.json({ error: 'Logo must be a PNG, SVG, JPG, or WebP image.' }, { status: 400 });
    }
    const safeName = `logo_${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}`;
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(safeName, contentType, true);
    return NextResponse.json({ uploadUrl, cloud_storage_path, publicUrl: getPublicUrl(cloud_storage_path) });
  } catch (err) {
    console.error('[presets] presign logo error:', err);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
