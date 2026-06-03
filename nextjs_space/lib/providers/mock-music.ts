import { Provider, MusicInput, MusicOutput } from './types';

const MOOD_TRACKS: Record<string, string> = {
  manifestation: '/mock/track-manifestation.mp3',
  meditation: '/mock/track-meditation.mp3',
  'wealth-frequency': '/mock/track-wealth-frequency.mp3',
  cinematic: '/mock/track-cinematic.mp3',
};

export class MockMusicProvider implements Provider<MusicInput, MusicOutput> {
  getName(): string { return 'MockMusic'; }
  estimateCost(): number { return 0.20; }

  async generate(input: MusicInput): Promise<MusicOutput> {
    await new Promise(r => setTimeout(r, 500));
    const mood = (input?.mood ?? '').toLowerCase();
    return {
      musicUrl: MOOD_TRACKS[mood] ?? '/mock/track-manifestation.mp3',
      durationSec: input?.durationSec ?? 30,
    };
  }
}
