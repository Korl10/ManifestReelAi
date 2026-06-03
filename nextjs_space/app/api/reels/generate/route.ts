export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { checkQuota, incrementUsage } from '@/lib/quota';
import { runGenerationPipeline } from '@/lib/generation-pipeline';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { prompt, platform, style, voice, mood } = body ?? {};

    if (!prompt || !platform || !style || !voice || !mood) {
      return NextResponse.json({ error: 'All fields are required: prompt, platform, style, voice, mood' }, { status: 400 });
    }

    // SERVER-SIDE QUOTA CHECK
    const quota = await checkQuota(userId);
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.message, quota }, { status: 403 });
    }

    // Create reel + job
    const reel = await prisma.reel.create({
      data: { userId, prompt, platform, style, voice, mood, status: 'rendering' },
    });

    const job = await prisma.generationJob.create({
      data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
    });

    await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

    // Increment usage
    await incrementUsage(userId);

    // Start pipeline (fire-and-forget)
    runGenerationPipeline(job.id, reel.id, userId).catch(console.error);

    return NextResponse.json({ jobId: job.id, reelId: reel.id }, { status: 201 });
  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 });
  }
}
