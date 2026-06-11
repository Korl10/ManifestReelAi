export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/abuse
 * Returns trial locks + blocked domains for the admin abuse dashboard.
 *
 * POST /api/admin/abuse
 * Actions: add_domain, remove_domain, override_lock, update_outcome
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [trialLocks, blockedDomains, stats] = await Promise.all([
      prisma.trialLock.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.blockedDomain.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.trialLock.groupBy({
        by: ['trialOutcome'],
        _count: true,
      }),
    ]);

    const outcomeStats: Record<string, number> = {};
    stats.forEach((s) => {
      outcomeStats[s.trialOutcome] = s._count;
    });

    return NextResponse.json({
      trialLocks,
      blockedDomains,
      outcomeStats,
      totalLocks: trialLocks.length,
    });
  } catch (err) {
    console.error('[admin/abuse] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'add_domain': {
        const { domain } = body;
        if (!domain || typeof domain !== 'string') {
          return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
        }
        const normalizedDomain = domain.toLowerCase().trim();
        await prisma.blockedDomain.upsert({
          where: { domain: normalizedDomain },
          create: { domain: normalizedDomain, source: 'admin' },
          update: { source: 'admin' },
        });
        return NextResponse.json({ success: true, domain: normalizedDomain });
      }

      case 'remove_domain': {
        const { domainId } = body;
        if (!domainId) {
          return NextResponse.json({ error: 'Domain ID is required' }, { status: 400 });
        }
        await prisma.blockedDomain.delete({ where: { id: domainId } });
        return NextResponse.json({ success: true });
      }

      case 'override_lock': {
        const { lockId, reason } = body;
        if (!lockId) {
          return NextResponse.json({ error: 'Lock ID is required' }, { status: 400 });
        }
        await prisma.trialLock.update({
          where: { id: lockId },
          data: {
            supportOverride: true,
            overrideReason: reason || 'Admin override',
          },
        });
        return NextResponse.json({ success: true });
      }

      case 'update_outcome': {
        const { lockId: id, outcome } = body;
        if (!id || !['PENDING', 'CONVERTED', 'CANCELLED', 'EXPIRED'].includes(outcome)) {
          return NextResponse.json({ error: 'Invalid lock ID or outcome' }, { status: 400 });
        }
        await prisma.trialLock.update({
          where: { id },
          data: { trialOutcome: outcome },
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[admin/abuse] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
