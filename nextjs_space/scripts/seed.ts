import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Admin user
  const adminHash = await bcrypt.hash('johndoe123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: { passwordHash: adminHash, role: 'admin', name: 'John Doe' },
    create: { email: 'john@doe.com', passwordHash: adminHash, role: 'admin', name: 'John Doe' },
  });
  console.log('Admin user upserted:', admin.email);

  // Admin subscription
  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: { tier: 'premium', status: 'active' },
    create: { userId: admin.id, tier: 'premium', status: 'active' },
  });

  // Admin credits
  await prisma.credit.upsert({
    where: { userId: admin.id },
    update: { balance: 100 },
    create: { userId: admin.id, balance: 100 },
  });

  // Demo user
  const demoHash = await bcrypt.hash('demo123456', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@manifestreel.ai' },
    update: { passwordHash: demoHash, name: 'Luna Starfield' },
    create: { email: 'demo@manifestreel.ai', passwordHash: demoHash, name: 'Luna Starfield' },
  });

  await prisma.subscription.upsert({
    where: { userId: demo.id },
    update: { tier: 'pro', status: 'active' },
    create: { userId: demo.id, tier: 'pro', status: 'active' },
  });

  await prisma.credit.upsert({
    where: { userId: demo.id },
    update: { balance: 0 },
    create: { userId: demo.id, balance: 0 },
  });

  // Demo reels for admin
  const demoReels = [
    {
      prompt: 'Create a viral manifestation reel about attracting wealth',
      style: 'wealth', platform: 'tiktok', voice: 'female', mood: 'manifestation',
      title: 'Money flows to me easily and effortlessly',
      caption: 'Money flows to me easily ✨ #wealthmindset #manifestation',
      description: 'This powerful wealth manifestation reel will align your energy with abundance.',
      hashtags: ['#wealthmindset', '#manifestation', '#abundance', '#lawofattraction', '#tiktokviral'],
      status: 'ready',
      costBreakdown: { script_cost: 0.02, voice_cost: 0.20, music_cost: 0.20, image_cost: 0.04, render_cost: 0.07, storage_cost: 0.01 },
      totalCost: 0.54,
      watermarked: false,
    },
    {
      prompt: 'Meditation reel for inner peace and calm',
      style: 'meditation', platform: 'instagram-reels', voice: 'meditation', mood: 'meditation',
      title: 'Find your center. Find your peace.',
      caption: 'Inner peace starts within 🧘 #meditation #innerpeace',
      description: 'A calming meditation reel for daily mindfulness practice.',
      hashtags: ['#meditation', '#innerpeace', '#mindfulness', '#calmvibes', '#reels'],
      status: 'ready',
      costBreakdown: { script_cost: 0.02, voice_cost: 0.20, music_cost: 0.20, image_cost: 0.04, render_cost: 0.07, storage_cost: 0.01 },
      totalCost: 0.54,
      watermarked: false,
    },
    {
      prompt: 'Motivational reel about never giving up',
      style: 'motivational', platform: 'youtube-shorts', voice: 'motivational', mood: 'cinematic',
      title: 'Today is the day everything changes',
      caption: 'Never give up 🔥 Your time is now #motivation',
      description: 'An empowering motivational reel to fuel your journey.',
      hashtags: ['#motivation', '#nevergiveup', '#grindset', '#successmindset', '#shorts'],
      status: 'scheduled',
      costBreakdown: { script_cost: 0.02, voice_cost: 0.20, music_cost: 0.20, image_cost: 0.04, render_cost: 0.07, storage_cost: 0.01 },
      totalCost: 0.54,
      watermarked: false,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      scheduledPlatform: 'youtube',
    },
  ];

  for (const reelData of demoReels) {
    const existing = await prisma.reel.findFirst({ where: { userId: admin.id, title: reelData.title } });
    if (!existing) {
      await prisma.reel.create({
        data: {
          userId: admin.id,
          ...reelData,
          scriptJson: {
            hook: reelData.title,
            fullScript: [
              { text: 'Line 1 of the script', startTime: 0, endTime: 3.5 },
              { text: 'Line 2 continues the message', startTime: 4, endTime: 7.5 },
              { text: 'Line 3 builds the energy', startTime: 8, endTime: 11.5 },
              { text: 'Line 4 delivers the impact', startTime: 12, endTime: 15.5 },
            ],
            rawText: reelData.caption,
          },
        },
      });
    }
  }

  console.log('Seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
