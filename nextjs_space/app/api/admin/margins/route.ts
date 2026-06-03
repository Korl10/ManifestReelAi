export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const TIER_PRICES: Record<string, number> = { free: 0, pro: 19.99, premium: 49.99 };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const subs = await prisma.subscription.findMany();
  const monthlyRevenue = subs.reduce((s: number, sub: any) => s + (TIER_PRICES[sub?.tier] ?? 0), 0);

  const reels = await prisma.reel.findMany({
    select: { totalCost: true, createdAt: true, costBreakdown: true },
    orderBy: { createdAt: 'asc' },
  });

  const totalCost = reels.reduce((s: number, r: any) => s + (r?.totalCost ?? 0), 0);

  // Group by month for chart
  const months: Record<string, { revenue: number; cost: number }> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const reel of reels) {
    const d = new Date(reel?.createdAt ?? Date.now());
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (!months[key]) months[key] = { revenue: 0, cost: 0 };
    months[key].cost += reel?.totalCost ?? 0;
  }
  // Add revenue proportionally
  const monthCount = Object.keys(months)?.length || 1;
  for (const key of Object.keys(months)) {
    months[key].revenue = monthlyRevenue / monthCount;
  }

  return NextResponse.json({
    monthlyRevenue,
    totalCost: Math.round(totalCost * 100) / 100,
    margin: monthlyRevenue > 0 ? Math.round(((monthlyRevenue - totalCost) / monthlyRevenue) * 100) : 0,
    chartData: Object.entries(months).map(([month, data]) => ({ month, revenue: Math.round((data?.revenue ?? 0) * 100) / 100, cost: Math.round((data?.cost ?? 0) * 100) / 100 })),
  });
}
