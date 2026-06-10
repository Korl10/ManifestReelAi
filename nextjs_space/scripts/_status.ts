import { prisma } from '../lib/prisma';
(async () => {
  const id = process.argv[2];
  const r = await prisma.reel.findUnique({ where: { id } });
  const sj: any = r?.scenesJson ?? {};
  console.log(JSON.stringify({
    status: r?.status, videoUrl: r?.videoUrl, durationSec: r?.durationSec,
    motionClipCount: sj.motionClipCount, motionExpected: sj.motionExpected,
    motionVerified: sj.motionVerified, durationMet: sj.durationMet,
    durationDelta: sj.durationDelta, totalCost: r?.totalCost,
  }, null, 2));
  await prisma.$disconnect();
})();
