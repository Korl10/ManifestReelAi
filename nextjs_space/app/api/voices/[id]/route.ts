export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const voice = await prisma.customVoice.findUnique({ where: { id: params.id } });
    if (!voice || voice.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await deleteFile(voice.cloudStoragePath).catch(() => {});
    await prisma.customVoice.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete custom voice error:', err);
    return NextResponse.json({ error: 'Failed to delete voice' }, { status: 500 });
  }
}
