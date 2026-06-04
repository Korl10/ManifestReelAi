import { Provider, MusicInput, MusicOutput } from './types';
import { getMusicTrack } from '@/lib/reel-assets';
import { ensurePublicLocalAsset } from '@/lib/media-storage';

/**
 * Phase 1 music: curated 528Hz / ambient / cinematic royalty-free library that
 * ships inside /public. Returns BOTH the in-app path (for the browser player)
 * and a public S3 URL (so the FFmpeg compositor can fetch it).
 */
export class LibraryMusicProvider implements Provider<MusicInput, MusicOutput> {
  getName(): string { return 'LibraryMusic'; }
  estimateCost(): number { return 0; }

  async generate(input: MusicInput): Promise<MusicOutput> {
    const localPath = getMusicTrack(input?.mood);
    let publicMusicUrl: string | null = null;
    try {
      publicMusicUrl = await ensurePublicLocalAsset(localPath, 'audio/mpeg');
    } catch (e) {
      console.error('Music public upload failed:', e);
    }
    return {
      musicUrl: localPath,
      publicMusicUrl,
      durationSec: input?.durationSec ?? 30,
      provider: this.getName(),
    };
  }
}
