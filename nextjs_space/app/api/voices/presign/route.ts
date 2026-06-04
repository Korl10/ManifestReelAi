export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generatePresignedUploadUrl } from '@/lib/s3';

// Returns a presigned URL so the client can upload a voice sample directly to cloud storage
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { fileName, contentType } = body ?? {};
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName and contentType are required' }, { status: 400 });
    }
    // Voice samples are public so they can be played back via a simple <audio> element
    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(safeName, contentType, true);
    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (err) {
    console.error('Presign voice error:', err);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
