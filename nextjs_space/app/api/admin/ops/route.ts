export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { modelQueue, familyLimit } from '@/lib/concurrency/model-queue';

// Admin-only live operations dashboard data: per-model queue depth, average
// wait, and throughput. Powers /admin/ops (Fix B2).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stats = modelQueue.stats();
  const labels: Record<string, string> = {
    veo3: 'Veo 3 Fast (Cinematic motion)',
    kling: 'Kling 2.5 Turbo (Pro/Standard motion)',
    flux: 'Flux 1.1 Pro Ultra (Stills)',
  };
  const rows = stats.map((s: any) => ({
    ...s,
    label: labels[s.family] ?? s.family,
    configuredLimit: familyLimit(s.family),
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    queues: rows,
  });
}
