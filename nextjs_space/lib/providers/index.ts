import { LLMScriptProvider } from './llm-script';
import { AbacusImageProvider } from './image-gen';
import { ElevenLabsVoiceProvider } from './elevenlabs-voice';
import { LibraryMusicProvider } from './library-music';
import type {
  Provider,
  ScriptInput, ScriptOutput,
  ImageInput, ImageOutput,
  VoiceInput, VoiceOutput,
  MusicInput, MusicOutput,
} from './types';

/** Real LLM-powered manifestation script writer (with template fallback in the pipeline). */
export function getScriptProvider(): Provider<ScriptInput, ScriptOutput> {
  return new LLMScriptProvider();
}

/** Cinematic AI image generation (with bundled-still fallback in the pipeline). */
export function getImageProvider(): Provider<ImageInput, ImageOutput> {
  return new AbacusImageProvider();
}

/** Premium voiceover. Gracefully returns audioUrl=null when no ELEVENLABS_API_KEY is set. */
export function getVoiceProvider(): Provider<VoiceInput, VoiceOutput> {
  return new ElevenLabsVoiceProvider();
}

/** Curated royalty-free ambient / solfeggio music library. */
export function getMusicProvider(): Provider<MusicInput, MusicOutput> {
  return new LibraryMusicProvider();
}

export * from './types';
