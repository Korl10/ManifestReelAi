import { Provider, ScriptInput, ScriptOutput, ScriptLine } from './types';

const MOCK_SCRIPTS: Record<string, { hook: string; lines: string[] }> = {
  spiritual: {
    hook: 'The universe is conspiring in your favor right now',
    lines: [
      'Close your eyes and take a deep breath.',
      'Feel the energy of the universe flowing through you.',
      'You are a divine being of infinite power.',
      'Every cell in your body vibrates with abundance.',
      'The universe hears your deepest desires.',
      'Trust the process. Your manifestation is already on its way.',
      'Open your heart to receive all the blessings coming to you.',
    ],
  },
  wealth: {
    hook: 'Money flows to me easily and effortlessly',
    lines: [
      'I am a powerful magnet for wealth and prosperity.',
      'Every dollar I spend comes back to me multiplied.',
      'Abundance is my birthright and I claim it now.',
      'I see opportunities for wealth everywhere I look.',
      'My bank account grows larger every single day.',
      'I am worthy of financial freedom and luxury.',
      'Wealth consciousness is now my natural state of being.',
    ],
  },
  motivational: {
    hook: 'Today is the day everything changes for you',
    lines: [
      'You were not born to play small.',
      'Inside you is a power that the world has never seen.',
      'Every setback is a setup for your greatest comeback.',
      'Champions are built in the moments nobody is watching.',
      'Your potential is limitless when you believe in yourself.',
      'Rise up. Show up. Level up. Every single day.',
      'The only thing standing between you and greatness is action.',
    ],
  },
  meditation: {
    hook: 'Find your center. Find your peace.',
    lines: [
      'Let go of everything that no longer serves you.',
      'With each breath, you release tension and worry.',
      'You are grounded, centered, and at peace.',
      'The stillness within you holds infinite wisdom.',
      'Allow yourself to simply be in this moment.',
      'Peace flows through every part of your being.',
      'You are exactly where you need to be right now.',
    ],
  },
  default: {
    hook: 'Your reality is about to shift',
    lines: [
      'Everything you desire is already seeking you.',
      'Align your energy with your highest vision.',
      'You are creating your dream life right now.',
      'The universe rewards those who take inspired action.',
      'Trust your journey. Every step has purpose.',
      'You are becoming the best version of yourself.',
      'Manifest it. Believe it. Receive it.',
    ],
  },
};

const STYLE_HASHTAGS: Record<string, string[]> = {
  spiritual: ['#spiritualawakening', '#highervibration', '#divineguidance', '#souljourney', '#lightworker'],
  wealth: ['#wealthmindset', '#moneyaffirmations', '#abundancemindset', '#financialfreedom', '#prosperity'],
  motivational: ['#motivation', '#grindset', '#successmindset', '#levelup', '#nevergiveup'],
  meditation: ['#meditation', '#innerpeace', '#mindfulness', '#calmvibes', '#zenlife'],
  luxury: ['#luxurylife', '#abundanceliving', '#manifestluxury', '#richlife', '#opulence'],
  abundance: ['#abundance', '#manifestation', '#lawofattraction', '#manifest', '#attracting'],
  'law of attraction': ['#lawofattraction', '#loa', '#manifestyourdreams', '#vibrationalhealing', '#positiveenergy'],
};

export class MockScriptProvider implements Provider<ScriptInput, ScriptOutput> {
  getName(): string { return 'MockScript'; }
  estimateCost(): number { return 0.02; }

  async generate(input: ScriptInput): Promise<ScriptOutput> {
    await new Promise(r => setTimeout(r, 800));
    const styleKey = (input?.style ?? '').toLowerCase();
    const template = MOCK_SCRIPTS[styleKey] ?? MOCK_SCRIPTS['default'];
    const lines: ScriptLine[] = (template?.lines ?? []).map((text: string, i: number) => ({
      text,
      startTime: i * 4,
      endTime: (i + 1) * 4 - 0.5,
    }));

    const rawText = [template?.hook ?? '', ...(template?.lines ?? [])].join(' ').slice(0, 800);
    const baseHashtags = STYLE_HASHTAGS[styleKey] ?? STYLE_HASHTAGS['abundance'] ?? [];
    const platformTag = input?.platform === 'tiktok' ? '#tiktokviral' : input?.platform === 'youtube' ? '#shorts' : '#reels';

    return {
      hook: template?.hook ?? 'Your reality is about to shift',
      fullScript: lines,
      caption: `${template?.hook ?? ''} ✨ ${input?.prompt ?? 'Manifest your dreams'}`,
      description: `${template?.hook ?? ''}. This powerful ${styleKey} reel will help you align with your highest self and attract everything you desire. Save this and watch daily for best results.`,
      hashtags: [...baseHashtags, platformTag, '#manifestreelai'],
      suggestedTitle: `${(template?.hook ?? 'Manifestation').split(' ').slice(0, 5).join(' ')}...`,
      rawText,
    };
  }
}
