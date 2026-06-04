export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;
    const body = await request.json();
    const { event, metadata } = body ?? {};

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'Missing event name' }, { status: 400 });
    }

    await prisma.analyticsEvent.create({
      data: { userId, event, metadata: metadata ?? {} },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
