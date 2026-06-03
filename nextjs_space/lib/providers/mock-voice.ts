import { Provider, VoiceInput, VoiceOutput, WordTimestamp } from './types';

export class MockVoiceProvider implements Provider<VoiceInput, VoiceOutput> {
  getName(): string { return 'MockVoice'; }
  estimateCost(): number { return 0.20; }

  async generate(input: VoiceInput): Promise<VoiceOutput> {
    await new Promise(r => setTimeout(r, 600));
    const words = (input?.scriptText ?? '').split(/\s+/).filter(Boolean);
    const wordsPerSecond = input?.voicePreset === 'meditation' ? 1.5 : 2.5;
    const timestamps: WordTimestamp[] = words.map((word: string, i: number) => ({
      word,
      start: i / wordsPerSecond,
      end: (i + 0.8) / wordsPerSecond,
    }));
    const durationSec = (words?.length ?? 0) / wordsPerSecond + 1;
    return {
      audioUrl: '/mock/voiceover-placeholder.mp3',
      timestamps,
      durationSec,
    };
  }
}
