'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Sparkles } from 'lucide-react';

type ScriptLine = { text?: string; startTime?: number; endTime?: number };

type ReelPlayerProps = {
  videoUrl?: string | null;
  posterUrl?: string | null;
  musicUrl?: string | null;
  hook?: string | null;
  script?: ScriptLine[];
  watermarked?: boolean;
  title?: string | null;
  /** When true, the video already has audio + captions burned in. */
  composited?: boolean;
};

export default function ReelPlayer({ videoUrl, posterUrl, musicUrl, hook, script = [], watermarked, title, composited = false }: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);

  // Composited reels carry their own baked-in audio + burned captions, so we
  // never layer a separate music track or live caption overlay on top of them.
  const useOverlay = !composited;

  const lines = (script ?? []).filter((l) => (l?.text ?? '').trim().length > 0);
  const totalDuration = lines.length > 0 ? Math.max(...lines.map((l) => l?.endTime ?? 0), 0) : 28;

  const loopT = totalDuration > 0 ? time % (totalDuration + 1.5) : time;
  const activeLine =
    lines.find((l) => loopT >= (l?.startTime ?? 0) && loopT < (l?.endTime ?? 0)) ??
    (loopT < 1.2 && hook ? { text: hook } : undefined);

  const stopAll = useCallback(() => {
    videoRef.current?.pause();
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const startAll = useCallback(async () => {
    try {
      if (videoRef.current) {
        if (composited) {
          // Single source of truth: the composited MP4 with baked-in audio.
          videoRef.current.muted = muted;
          await videoRef.current.play();
        } else {
          videoRef.current.currentTime = videoRef.current.currentTime % (videoRef.current.duration || 1);
          await videoRef.current.play();
        }
      }
      if (useOverlay && audioRef.current && musicUrl) {
        audioRef.current.volume = 0.4;
        audioRef.current.muted = muted;
        await audioRef.current.play().catch(() => {});
      }
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [musicUrl, muted, composited, useOverlay]);

  const toggle = useCallback(() => {
    if (playing) stopAll();
    else startAll();
  }, [playing, startAll, stopAll]);

  // Master clock: composited -> the video; legacy -> the music track if present.
  useEffect(() => {
    const clockEl = (composited ? videoRef.current : musicUrl ? audioRef.current : videoRef.current) as HTMLMediaElement | null;
    if (!clockEl) return;
    const onTime = () => setTime(clockEl.currentTime ?? 0);
    clockEl.addEventListener('timeupdate', onTime);
    return () => clockEl.removeEventListener('timeupdate', onTime);
  }, [musicUrl, playing, composited]);

  useEffect(() => {
    if (composited) {
      if (videoRef.current) videoRef.current.muted = muted;
    } else if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted, composited]);

  const showMuteBtn = composited || !!musicUrl;

  return (
    <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black border border-white/10 group">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl ?? undefined}
          loop
          muted={!composited}
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#7B2FBE]/30 to-[#4A1A8A]/30" />
      )}

      {useOverlay && musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="none" />}

      {/* Readability scrim (overlay mode only — composited reels are pre-graded) */}
      {useOverlay && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40 pointer-events-none" />}

      {/* Live synced caption (overlay mode only) */}
      {useOverlay && (
        <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-center justify-center px-5 pointer-events-none">
          {activeLine?.text && (
            <p
              key={activeLine.text}
              className="text-center font-display font-extrabold leading-tight text-white text-xl sm:text-2xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] animate-[fadeIn_0.4s_ease]"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.95)' }}
            >
              {activeLine.text}
            </p>
          )}
        </div>
      )}

      {/* Watermark overlay (overlay mode only — composited reels bake it in) */}
      {useOverlay && watermarked && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm pointer-events-none">
          <span className="text-[10px] font-semibold text-[#D4AF37] tracking-wide">ManifestReel</span>
        </div>
      )}

      {/* Play / pause overlay */}
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className="absolute inset-0 flex items-center justify-center z-10"
      >
        <span
          className={`flex items-center justify-center w-16 h-16 rounded-full gold-gradient text-black shadow-2xl transition-all duration-300 ${
            playing ? 'opacity-0 group-hover:opacity-100 scale-90' : 'opacity-100 scale-100 animate-pulse-gold'
          }`}
        >
          {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
        </span>
      </button>

      {/* Mute toggle */}
      {showMuteBtn && (
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute bottom-3 right-3 z-10 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white/80 hover:text-white transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}

      {/* Idle hint */}
      {!playing && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm pointer-events-none">
          <Sparkles className="w-3 h-3 text-[#D4AF37]" />
          <span className="text-[10px] text-white/70">{title ? 'Tap to play' : 'Preview'}</span>
        </div>
      )}
    </div>
  );
}
