'use client';
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface YouTubePlayerProps {
  src: string;
  title: string;
  channel?: string;
  views?: string;
  timeAgo?: string;
}

export default function YouTubePlayer({ src, title, channel = 'ManifestReel AI', views = '', timeAgo = '' }: YouTubePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
    setCurrentTime(fmt(v.currentTime));
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(fmt(v.duration));
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setShowControls(true);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [playing]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div className="rounded-xl overflow-hidden bg-[#0f0f0f] border border-white/[0.08]">
      {/* Video area */}
      <div
        ref={containerRef}
        className="relative w-full cursor-pointer group"
        style={{ aspectRatio: '16 / 9' }}
        onClick={togglePlay}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => playing && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 w-full h-full object-cover bg-black"
          playsInline
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        {/* Big center play button — only when paused */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
            <div className="w-16 h-16 md:w-14 md:h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition shadow-xl">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-white ml-1" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom controls bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
            showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="h-[3px] hover:h-[5px] w-full bg-white/20 cursor-pointer transition-all group/bar relative"
            onClick={handleProgressClick}
          >
            <div className="absolute inset-y-0 left-0 bg-red-600" style={{ width: `${progress}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-600 opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-t from-black/90 to-black/40">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-white/80 transition p-1">
              {playing ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Volume */}
            <button onClick={toggleMute} className="text-white hover:text-white/80 transition p-1">
              {muted ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0020 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              )}
            </button>

            {/* Time */}
            <span className="text-white/70 text-[11px] font-mono tabular-nums">
              {currentTime} / {duration}
            </span>

            <div className="flex-1" />

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition p-1">
              {fullscreen ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Video info — YouTube style */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">{title}</h3>
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-xs text-white/50">{channel}</span>
          {views && <span className="text-xs text-white/50">• {views}</span>}
          {timeAgo && <span className="text-xs text-white/50">• {timeAgo}</span>}
        </div>
      </div>
    </div>
  );
}
