export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';
const MODEL = process.env.SCRIPT_MODEL || 'gpt-5.4';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { style, mood, platform, currentPrompt } = body;

  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const systemMsg = `You are an expert manifestation and Law of Attraction content creator. Generate ONE enriched, viral-worthy prompt for a short-form reel.

Rules:
- Output a single paragraph (2-4 sentences) that is vivid, emotionally charged, and specific.
- Include sensory details, emotional states, and a clear intention/desire.
- Match the given style, mood, and platform vibes.
- If the user provided a rough idea, transform it into a premium prompt. If blank, create an inspiring original.
- NO hashtags, NO titles, just the raw intention prompt.
- Keep it under 200 words.`;

  const userMsg = [
    `Style: ${style || 'Spiritual'}`,
    `Mood: ${mood || 'Manifestation'}`,
    `Platform: ${platform || 'TikTok'}`,
    currentPrompt ? `User's rough idea: "${currentPrompt}"` : 'No user idea — create an inspiring original prompt.',
  ].join('\n');

  try {
    const res = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 300,
        temperature: 0.95,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[auto-prompt] LLM error:', res.status, t.slice(0, 200));
      return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 });
    }
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    return NextResponse.json({ prompt: text });
  } catch (err: any) {
    console.error('[auto-prompt] error:', err?.message);
    return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 });
  }
}
