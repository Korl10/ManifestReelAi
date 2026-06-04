export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getScriptProvider, getVoiceProvider, getMusicProvider } from '@/lib/providers';
import { buildTemplateScript } from '@/lib/providers/fallback';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { section } = body ?? {};
  const reel = await prisma.reel.findFirst({ where: { id: params.id, userId } });
  if (!reel) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });

  if (section === 'script') {
    let result;
    try {
      const provider = getScriptProvider();
      result = await provider.generate({ prompt: reel.prompt, platform: reel.platform, style: reel.style, mood: reel.mood });
    } catch (e) {
      result = buildTemplateScript({ prompt: reel.prompt, platform: reel.platform, style: reel.style, mood: reel.mood });
    }
    await prisma.reel.update({
      where: { id: params.id },
      data: { scriptJson: result as any, caption: result.caption, description: result.description, hashtags: result.hashtags },
    });
  } else if (section === 'voice') {
    const provider = getVoiceProvider();
    const scriptJson = reel.scriptJson as any;
    const text = scriptJson?.rawText ?? reel.prompt;
    const result = await provider.generate({ scriptText: text, voicePreset: reel.voice });
    await prisma.reel.update({ where: { id: params.id }, data: { audioUrl: result.audioUrl } });
  } else if (section === 'music') {
    const provider = getMusicProvider();
    const result = await provider.generate({ mood: reel.mood, durationSec: 30 });
    await prisma.reel.update({ where: { id: params.id }, data: { musicUrl: result.musicUrl } });
  }

  const updated = await prisma.reel.findUnique({ where: { id: params.id } });
  return NextResponse.json(updated);
}
