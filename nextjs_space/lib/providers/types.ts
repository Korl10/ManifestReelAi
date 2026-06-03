export interface Provider<TInput, TOutput> {
  generate(input: TInput): Promise<TOutput>;
  estimateCost(input: TInput): number;
  getName(): string;
}

export interface ScriptInput {
  prompt: string;
  platform: string;
  style: string;
}

export interface ScriptLine {
  text: string;
  startTime: number;
  endTime: number;
}

export interface ScriptOutput {
  hook: string;
  fullScript: ScriptLine[];
  caption: string;
  description: string;
  hashtags: string[];
  suggestedTitle: string;
  rawText: string;
}

export interface VoiceInput {
  scriptText: string;
  voicePreset: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface VoiceOutput {
  audioUrl: string;
  timestamps: WordTimestamp[];
  durationSec: number;
}

export interface MusicInput {
  mood: string;
  durationSec: number;
}

export interface MusicOutput {
  musicUrl: string;
  durationSec: number;
}

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
