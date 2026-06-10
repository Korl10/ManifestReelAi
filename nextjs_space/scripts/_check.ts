import { prisma } from '../lib/prisma';
(async () => {
  const u = await prisma.user.findUnique({ where: { email: 'john@doe.com' }, select: { id: true, email: true } });
  const sub = u ? await prisma.subscription.findUnique({ where: { userId: u.id }, select: { tier: true } }) : null;
  const cr = u ? await prisma.credit.findUnique({ where: { userId: u.id }, select: { balance: true } }) : null;
  console.log(JSON.stringify({ u, sub, credit: cr }));
  await prisma.$disconnect();
})();
