import { MockScriptProvider } from './mock-script';
import { MockVoiceProvider } from './mock-voice';
import { MockMusicProvider } from './mock-music';
import { MockVideoProvider } from './mock-video';
import { MockRenderProvider } from './mock-render';
import type { Provider, ScriptInput, ScriptOutput, VoiceInput, VoiceOutput, MusicInput, MusicOutput, VideoInput, VideoOutput, RenderInput, RenderOutput } from './types';

export function getScriptProvider(): Provider<ScriptInput, ScriptOutput> {
  // Future: check process.env.OPENAI_API_KEY and return real provider
  return new MockScriptProvider();
}

export function getVoiceProvider(): Provider<VoiceInput, VoiceOutput> {
  return new MockVoiceProvider();
}

export function getMusicProvider(): Provider<MusicInput, MusicOutput> {
  return new MockMusicProvider();
}

export function getVideoProvider(): Provider<VideoInput, VideoOutput> {
  return new MockVideoProvider();
}

export function getRenderProvider(): Provider<RenderInput, RenderOutput> {
  return new MockRenderProvider();
}

export * from './types';
