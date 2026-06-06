'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Sparkles, X, Check, Crown } from 'lucide-react';
import type { SubtitleStyle } from '@/lib/captions/subtitle-types';

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
  /** Subtitle styling so the live overlay matches the final burned-in captions (WYSIWYG). */
  subtitleStyle?: Partial<SubtitleStyle> | null;
  /** True for free-tier reels — enables the tappable watermark + post-playback upgrade prompt. */
  isFree?: boolean;
  /** Fired when the user taps the watermark or the upgrade CTA. Routes to the upgrade flow. */
  onUpgradeClick?: () => void;
};

/**
 * Completely stop and dispose an HTMLMediaElement to prevent audio leak.
 * After this call the element will NOT play any further audio.
 */
function disposeMedia(el: HTMLMediaElement | null) {
  if (!el) return;
  try {
    el.pause();
    el.currentTime = 0;
    el.src = '';
    el.load(); // forces release of the previous media resource
  } catch {
    /* swallow — element may already be detached */
  }
}

export default function ReelPlayer({ videoUrl, posterUrl, musicUrl, hook, script = [], watermarked, title, composited = false, subtitleStyle, isFree, onUpgradeClick }: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // The upgrade wall is eligible whenever this is a watermarked / free reel.
  const wallEligible = !!(watermarked || isFree);
  const upgradeFiredRef = useRef(false);

  const triggerUpgrade = useCallback(() => {
    setShowUpgrade(true);
    stopAllRef.current?.();
  }, []);
  const stopAllRef = useRef<(() => void) | null>(null);

  // Composited reels carry their own baked-in audio + burned captions, so we
  // never layer a separate music track or live caption overlay on top of them.
  const useOverlay = !composited;

  const lines = (script ?? []).filter((l) => (l?.text ?? '').trim().length > 0);
  const totalDuration = lines.length > 0 ? Math.max(...lines.map((l) => l?.endTime ?? 0), 0) : 28;

  const loopT = totalDuration > 0 ? time % (totalDuration + 1.5) : time;
  const activeLine =
    lines.find((l) => loopT >= (l?.startTime ?? 0) && loopT < (l?.endTime ?? 0)) ??
    (loopT < 1.2 && hook ? { text: hook } : undefined);

  // -----------------------------------------------------------------------
  // AUDIO LIFECYCLE — stop & dispose on prop changes to prevent overlap.
  // -----------------------------------------------------------------------

  // When musicUrl or videoUrl changes, STOP everything first to prevent
  // phantom playback from the old source (BUG #1 fix).
  const prevMusicUrl = useRef(musicUrl);
  const prevVideoUrl = useRef(videoUrl);

  useEffect(() => {
    const musicChanged = musicUrl !== prevMusicUrl.current;
    const videoChanged = videoUrl !== prevVideoUrl.current;
    prevMusicUrl.current = musicUrl;
    prevVideoUrl.current = videoUrl;

    if (musicChanged || videoChanged) {
      // Immediately stop any active playback so old+new never overlap.
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlaying(false);
      setTime(0);
    }
  }, [musicUrl, videoUrl]);

  // Full cleanup on unmount — prevents ghost audio when navigating away.
  useEffect(() => {
    return () => {
      disposeMedia(videoRef.current);
      disposeMedia(audioRef.current);
    };
  }, []);

  const stopAll = useCallback(() => {
    videoRef.current?.pause();
    audioRef.current?.pause();
    setPlaying(false);
  }, []);
  stopAllRef.current = stopAll;

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
    const onTime = () => {
      const t = clockEl.currentTime ?? 0;
      setTime(t);
      // Free-reel upgrade wall: fire once the first full play-through completes.
      if (wallEligible && onUpgradeClick && !upgradeFiredRef.current) {
        const dur = clockEl.duration && isFinite(clockEl.duration) ? clockEl.duration : totalDuration;
        if (dur > 0 && t >= dur - 0.25) {
          upgradeFiredRef.current = true;
          triggerUpgrade();
        }
      }
    };
    clockEl.addEventListener('timeupdate', onTime);
    return () => clockEl.removeEventListener('timeupdate', onTime);
  }, [musicUrl, playing, composited, wallEligible, onUpgradeClick, totalDuration, triggerUpgrade]);

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
          loop={!(wallEligible && !!onUpgradeClick)}
          muted={!composited}
          playsInline
          preload="metadata"
          onEnded={() => {
            if (wallEligible && onUpgradeClick && !upgradeFiredRef.current) {
              upgradeFiredRef.current = true;
              triggerUpgrade();
            }
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#7B2FBE]/30 to-[#4A1A8A]/30" />
      )}

      {useOverlay && musicUrl && <audio ref={audioRef} src={musicUrl} loop preload="none" />}

      {/* Readability scrim (overlay mode only — composited reels are pre-graded) */}
      {useOverlay && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40 pointer-events-none" />}

      {/* Live synced caption (overlay mode only). Honors subtitleStyle so the preview matches the final MP4. */}
      {useOverlay && (
        <div
          className="absolute left-5 right-5 flex items-center justify-center pointer-events-none"
          style={
            subtitleStyle?.position === 'top'
              ? { top: '10%' }
              : subtitleStyle?.position === 'center'
                ? { top: '42%' }
                : { bottom: '14%' }
          }
        >
          {activeLine?.text && (
            <p
              key={activeLine.text}
              className="text-center leading-tight animate-[fadeIn_0.4s_ease]"
              style={{
                fontFamily: subtitleStyle?.fontFamily ? `'${subtitleStyle.fontFamily}', sans-serif` : undefined,
                fontWeight: 700,
                color: subtitleStyle?.textColor ?? '#FFFFFF',
                fontSize: 'clamp(1.1rem, 6vw, 1.9rem)',
                WebkitTextStroke:
                  subtitleStyle?.strokeWidth && subtitleStyle.strokeWidth > 0
                    ? `${Math.max(0.5, subtitleStyle.strokeWidth / 4)}px ${subtitleStyle.strokeColor ?? '#000000'}`
                    : undefined,
                textShadow:
                  subtitleStyle?.shadowEnabled === false
                    ? 'none'
                    : `${subtitleStyle?.shadowDepth ?? 2}px ${subtitleStyle?.shadowDepth ?? 2}px ${(subtitleStyle?.shadowDepth ?? 2) * 2}px ${subtitleStyle?.shadowColor ?? 'rgba(0,0,0,0.95)'}`,
                backgroundColor:
                  subtitleStyle?.highlightEnabled && subtitleStyle?.highlightColor
                    ? `${subtitleStyle.highlightColor}${Math.round((subtitleStyle.highlightOpacity ?? 60) * 2.55).toString(16).padStart(2, '0')}`
                    : 'transparent',
                padding: subtitleStyle?.highlightEnabled ? '2px 8px' : undefined,
                borderRadius: subtitleStyle?.highlightEnabled ? 6 : undefined,
              }}
            >
              {activeLine.text}
            </p>
          )}
        </div>
      )}

      {/* Tappable watermark — fires the upgrade flow. Renders for both overlay
          and composited reels so the baked-in watermark also gets a tap target. */}
      {watermarked && (
        onUpgradeClick ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUpgradeClick(); }}
            aria-label="Remove watermark — upgrade to Pro"
            className="absolute bottom-3 left-3 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-black/55 backdrop-blur-sm hover:bg-black/75 transition-colors"
          >
            <span className="text-[10px] font-semibold text-white/70 tracking-wide group-hover:text-white">ManifestReel AI</span>
            <Crown className="w-3 h-3 text-[#D4AF37]" />
          </button>
        ) : useOverlay ? (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm pointer-events-none">
            <span className="text-[10px] font-semibold text-white/50 tracking-wide">ManifestReel AI</span>
          </div>
        ) : null
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
      {!playing && !showUpgrade && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm pointer-events-none">
          <Sparkles className="w-3 h-3 text-[#D4AF37]" />
          <span className="text-[10px] text-white/70">{title ? 'Tap to play' : 'Preview'}</span>
        </div>
      )}

      {/* Post-playback upgrade wall (free reels only) */}
      {showUpgrade && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <button
            onClick={() => setShowUpgrade(false)}
            aria-label="Close"
            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="mt-6 text-center">
            <p className="text-base font-bold text-white leading-tight">🎬 Your AI Reel is Ready!</p>
            <p className="text-[12px] text-white/60 mt-1">Want it without the watermark — and 6× longer?</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {/* Free */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wide">Free</p>
              <ul className="mt-2 space-y-1.5">
                {['5-second reel', 'Watermarked', 'Standard AI visuals', '1 reel total'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-white/55">
                    <span className="mt-[3px] w-1 h-1 rounded-full bg-white/30 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            {/* Pro */}
            <div className="rounded-xl border border-[#D4AF37]/40 bg-gradient-to-b from-[#D4AF37]/[0.12] to-transparent p-2.5">
              <p className="text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wide flex items-center gap-1"><Crown className="w-3 h-3 text-[#D4AF37]" />Pro</p>
              <ul className="mt-2 space-y-1.5">
                {['Up to 30 seconds', 'No watermark · HD', 'Cinematic motion', 'Custom voices & music', 'Brand presets'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-white">
                    <Check className="w-3 h-3 text-[#D4AF37] mt-[1px] shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button
            onClick={() => { setShowUpgrade(false); onUpgradeClick?.(); }}
            className="mt-4 w-full gold-gradient text-black font-semibold rounded-xl py-2.5 text-sm"
          >
            Upgrade to Pro →
          </button>
          <button
            onClick={() => { setShowUpgrade(false); upgradeFiredRef.current = false; }}
            className="mt-2 w-full text-[11px] text-white/50 hover:text-white/80 transition-colors"
          >
            Replay free reel
          </button>
        </div>
      )}
    </div>
  );
}
