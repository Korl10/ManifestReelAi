export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
  return NextResponse.json(reel);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { caption, description, hashtags, title } = body ?? {};
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
  const updated = await prisma.reel.update({
    where: { id: params.id },
    data: {
      ...(caption !== undefined && { caption }),
      ...(description !== undefined && { description }),
      ...(hashtags !== undefined && { hashtags }),
      ...(title !== undefined && { title }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
  await prisma.reel.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
