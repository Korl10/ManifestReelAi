import { LLMScriptProvider } from './llm-script';
import { AbacusImageProvider } from './image-gen';
import { ElevenLabsVoiceProvider } from './elevenlabs-voice';
import { LibraryMusicProvider } from './library-music';
import { FalaiVideoProvider } from './falai-video';
import { FluxImageProvider } from './flux-image';
import type {
  Provider,
  ScriptInput, ScriptOutput,
  ImageInput, ImageOutput,
  VoiceInput, VoiceOutput,
  MusicInput, MusicOutput,
  VideoClipInput, VideoClipOutput,
} from './types';

/** Real LLM-powered manifestation script writer (with template fallback in the pipeline). */
export function getScriptProvider(): Provider<ScriptInput, ScriptOutput> {
  return new LLMScriptProvider();
}

/** Cinematic AI image generation (with bundled-still fallback in the pipeline). */
export function getImageProvider(): Provider<ImageInput, ImageOutput> {
  return new AbacusImageProvider();
}

/** fal.ai Flux image generation for model tiers (Flux 1.1 Pro / Pro Ultra). */
export function getFluxImageProvider(model?: string, pricePerImage?: number): Provider<ImageInput, ImageOutput> {
  return new FluxImageProvider(model, pricePerImage);
}

/** Premium voiceover. Gracefully returns audioUrl=null when no ELEVENLABS_API_KEY is set. */
export function getVoiceProvider(): Provider<VoiceInput, VoiceOutput> {
  return new ElevenLabsVoiceProvider();
}

/** Curated royalty-free ambient / solfeggio music library. */
export function getMusicProvider(): Provider<MusicInput, MusicOutput> {
  return new LibraryMusicProvider();
}

/** Cinematic image-to-video motion (fal.ai, model-aware). Fails gracefully to stills. */
export function getVideoProvider(model?: string, pricePerSec?: number): Provider<VideoClipInput, VideoClipOutput> {
  return new FalaiVideoProvider(model, pricePerSec);
}

export * from './types';
