import { Provider, VideoInput, VideoOutput } from './types';

export class MockVideoProvider implements Provider<VideoInput, VideoOutput> {
  getName(): string { return 'MockVideo'; }
  estimateCost(): number { return 0.04; }

  async generate(input: VideoInput): Promise<VideoOutput> {
    await new Promise(r => setTimeout(r, 700));
    return {
      backgroundUrls: [
        '/mock/bg-spiritual-1.jpg',
        '/mock/bg-spiritual-2.jpg',
      ],
      thumbnailUrl: `/mock/thumb-${(input?.style ?? 'spiritual').toLowerCase()}.jpg`,
    };
  }
}
