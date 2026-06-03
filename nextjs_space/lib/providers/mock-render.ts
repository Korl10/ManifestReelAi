import { Provider, RenderInput, RenderOutput } from './types';

export class MockRenderProvider implements Provider<RenderInput, RenderOutput> {
  getName(): string { return 'MockRender'; }
  estimateCost(): number { return 0.07; }

  async generate(input: RenderInput): Promise<RenderOutput> {
    await new Promise(r => setTimeout(r, 1000));
    return {
      videoUrl: '/mock/final-reel.mp4',
      durationSec: input?.voiceover?.durationSec ?? 30,
      fileSize: 5242880,
    };
  }
}
