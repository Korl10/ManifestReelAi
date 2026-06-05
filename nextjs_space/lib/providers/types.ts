export interface Provider<TInput, TOutput> {
  generate(input: TInput): Promise<TOutput>;
  estimateCost(input: TInput): number;
  getName(): string;
}

export interface ScriptInput {
  prompt: string;
  platform: string;
  style: string;
  mood?: string;
}

export interface ScriptLine {
  text: string;
  startTime: number;
  endTime: number;
}

export interface ScriptScene {
  text: string;
  imagePrompt: string;
  startTime: number;
  endTime: number;
}

export interface ScriptOutput {
  hook: string;
  fullScript: ScriptLine[];
  scenes: ScriptScene[];
  caption: string;
  description: string;
  hashtags: string[];
  suggestedTitle: string;
  rawText: string;
  estimatedDurationSec: number;
}

export interface VoiceInput {
  scriptText: string;
  voicePreset: string;
  lines?: ScriptLine[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface VoiceOutput {
  audioUrl: string | null;
  timestamps: WordTimestamp[];
  durationSec: number;
  provider: string;
}

export interface ImageInput {
  scenes: { imagePrompt: string }[];
  style: string;
  mood: string;
}

export interface ImageOutput {
  sceneImageUrls: string[];
  thumbnailUrl: string;
  provider: string;
}

export interface MusicInput {
  mood: string;
  durationSec: number;
}

export interface MusicOutput {
  musicUrl: string;
  publicMusicUrl: string | null;
  durationSec: number;
  provider: string;
}

// Legacy video provider types kept for backward compatibility.
export interface VideoInput {
  style: string;
  mood: string;
  themes: string[];
}

export interface VideoOutput {
  backgroundUrls: string[];
  thumbnailUrl: string;
}

export interface RenderInput {
  voiceover: VoiceOutput;
  music: MusicOutput;
  visuals: VideoOutput;
  timestamps: WordTimestamp[];
  watermark: boolean;
}

export interface RenderOutput {
  videoUrl: string;
  durationSec: number;
  fileSize: number;
}

// ── Image-to-video (motion) provider ────────────────────────────
// Generates short cinematic motion clips from selected "hero" scene
// images. Non-hero scenes stay as Ken Burns stills in the compositor.
export interface VideoClipInput {
  /** Public scene image URLs (one per scene). */
  sceneImageUrls: string[];
  /** 0-based indices of the scenes to animate. */
  heroIndices: number[];
  /** Per-scene image prompts (used for per-scene motion theming). */
  imagePrompts: string[];
  /** Reel style (fallback motion theming). */
  style: string;
  /** Reel mood (adds vibe tokens to motion prompt). */
  mood?: string;
  /** Clip duration in seconds (5 or 10). */
  durationSec: number;
  /** Override fal.ai video model id (from the selected model tier). */
  videoModel?: string;
  /** Override USD/sec pricing for the chosen model. */
  videoPricePerSec?: number;
}

export interface VideoClipOutput {
  /**
   * Motion clip URLs aligned to scene index (length === sceneImageUrls.length).
   * null means "no motion for this scene" (non-hero, or generation failed →
   * the compositor falls back to a Ken Burns still).
   */
  clipUrls: (string | null)[];
  /** Number of clips actually generated successfully. */
  generatedCount: number;
  provider: string;
  /** Measured cost (USD) for the clips that were generated. */
  cost: number;
}
