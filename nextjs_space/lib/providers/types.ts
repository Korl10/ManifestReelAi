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
