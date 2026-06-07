export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generatePresignedUploadUrl } from '@/lib/s3';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { fileName, contentType } = await request.json();
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName and contentType required' }, { status: 400 });
    }
    const safeName = `music-v2/${Date.now()}-${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}`;
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(safeName, contentType, true);
    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (err) {
    console.error('[music-loader/presign] error:', err);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
