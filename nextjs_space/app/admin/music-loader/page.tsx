'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload, Music2, Loader2, CheckCircle2, XCircle, AlertCircle,
  FileAudio, Play, Trash2, RefreshCw, Eye, Zap,
} from 'lucide-react';

const CATEGORIES = [
  'spiritual', 'luxury', 'motivational', 'mysterious',
  'historical', 'biblical', 'educated', 'meditation',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  spiritual: 'bg-purple-500/20 text-purple-300',
  luxury: 'bg-amber-500/20 text-amber-300',
  motivational: 'bg-orange-500/20 text-orange-300',
  mysterious: 'bg-indigo-500/20 text-indigo-300',
  historical: 'bg-teal-500/20 text-teal-300',
  biblical: 'bg-sky-500/20 text-sky-300',
  educated: 'bg-emerald-500/20 text-emerald-300',
  meditation: 'bg-pink-500/20 text-pink-300',
};

interface FileEntry {
  file: File;
  filename: string;
  durationSec: number | null;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  result?: any;
  cloudStoragePath?: string;
}

interface ExistingTrack {
  id: string;
  title: string;
  slug: string;
  category: string;
  sequence: number;
  cloudUrl: string;
  durationSec: number;
  bpm: number | null;
  mood: string[];
  style: string[];
  energy: string;
  isActive: boolean;
  createdAt: string;
}

export default function MusicLoaderPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dryRunResults, setDryRunResults] = useState<any[] | null>(null);
  const [existing, setExisting] = useState<ExistingTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fetchedExisting, setFetchedExisting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  // Fetch existing tracks
  const fetchExisting = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/music-loader');
      const data = await res.json();
      setExisting(data.tracks || []);
      setFetchedExisting(true);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Load on first render
  useState(() => { fetchExisting(); });

  // Get audio duration from File
  const probeDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      });
      audio.addEventListener('error', () => {
        resolve(0);
        URL.revokeObjectURL(url);
      });
    });

  // Handle file selection
  const handleFiles = useCallback(async (fileList: FileList) => {
    const mp3s = Array.from(fileList).filter(f =>
      f.type === 'audio/mpeg' || f.name.toLowerCase().endsWith('.mp3')
    );
    if (mp3s.length === 0) return;

    const entries: FileEntry[] = [];
    for (const f of mp3s) {
      const dur = await probeDuration(f);
      entries.push({
        file: f,
        filename: f.name,
        durationSec: dur > 0 ? Math.round(dur * 10) / 10 : null,
        status: 'pending',
      });
    }
    setFiles(prev => [...prev, ...entries]);
    setDryRunResults(null);
  }, []);

  // Dry run
  const handleDryRun = async () => {
    setProcessing(true);
    try {
      const payload = files.map(f => ({
        filename: f.filename,
        durationSec: f.durationSec,
        cloudStoragePath: '', // not needed for dry run
      }));
      const res = await fetch('/api/admin/music-loader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload, dryRun: true }),
      });
      const data = await res.json();
      setDryRunResults(data.results || []);
    } catch (e) {
      console.error('Dry run failed:', e);
    }
    setProcessing(false);
  };

  // Full upload + process
  const handleCommit = async () => {
    setProcessing(true);
    const updated = [...files];

    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i];
      if (entry.status === 'done') continue;

      // Step 1: Get presigned URL
      try {
        updated[i] = { ...entry, status: 'uploading' };
        setFiles([...updated]);

        const presignRes = await fetch('/api/admin/music-loader/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: entry.filename, contentType: 'audio/mpeg' }),
        });
        const { uploadUrl, cloud_storage_path } = await presignRes.json();
        if (!uploadUrl) throw new Error('No upload URL returned');

        // Step 2: Upload to S3
        // Check X-Amz-SignedHeaders for required headers
        const signedHeaders = new URL(uploadUrl).searchParams.get('X-Amz-SignedHeaders') || '';
        const uploadHeaders: Record<string, string> = { 'Content-Type': 'audio/mpeg' };
        if (signedHeaders.includes('content-disposition')) {
          uploadHeaders['Content-Disposition'] = 'attachment';
        }
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: entry.file,
        });
        if (!uploadRes.ok) throw new Error(`S3 upload failed: ${uploadRes.status}`);

        updated[i] = { ...updated[i], status: 'processing', cloudStoragePath: cloud_storage_path };
        setFiles([...updated]);
      } catch (err: any) {
        updated[i] = { ...updated[i], status: 'error', error: err?.message || 'Upload failed' };
        setFiles([...updated]);
        continue;
      }
    }

    // Step 3: Call the API to process all uploaded files
    const uploaded = updated.filter(f => f.status === 'processing' && f.cloudStoragePath);
    if (uploaded.length > 0) {
      try {
        const payload = uploaded.map(f => ({
          filename: f.filename,
          durationSec: f.durationSec,
          cloudStoragePath: f.cloudStoragePath,
        }));
        const res = await fetch('/api/admin/music-loader', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: payload, dryRun: false }),
        });
        const data = await res.json();

        // Update statuses from results
        for (const result of (data.results || [])) {
          const idx = updated.findIndex(f => f.filename === result.filename);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              status: result.status === 'error' ? 'error' : 'done',
              error: result.error,
              result,
            };
          }
        }
        setFiles([...updated]);
      } catch (err: any) {
        // Mark remaining as error
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].status === 'processing') {
            updated[i] = { ...updated[i], status: 'error', error: err?.message || 'Processing failed' };
          }
        }
        setFiles([...updated]);
      }
    }

    setProcessing(false);
    fetchExisting(); // Refresh the list
  };

  const clearFiles = () => { setFiles([]); setDryRunResults(null); };

  const togglePlay = (url: string) => {
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(url);
    a.play().catch(() => {});
    a.onended = () => setPlayingUrl(null);
    audioRef.current = a;
    setPlayingUrl(url);
  };

  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'uploading' || f.status === 'processing').length;
  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  // Category stats for existing tracks
  const catStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const c of CATEGORIES) stats[c] = 0;
    for (const t of existing) stats[t.category] = (stats[t.category] || 0) + 1;
    return stats;
  }, [existing]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <Music2 className="w-5 h-5 text-[#D4AF37]" /> Music Loader — Vol. 2
          </h1>
          <p className="text-sm text-white/40 mt-1 max-w-2xl">
            Drop Suno tracks here. Filename pattern: <code className="text-white/60">{'category'}_{'{nn}'}_{'{descriptor}'}.mp3</code><br />
            Categories: {CATEGORIES.join(', ')}. Auto-tags mood/energy, applies 0.5s fade-in + LUFS -14 normalization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{existing.length} tracks loaded</span>
          <button onClick={fetchExisting} className="p-2 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category stats */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <div key={c} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${CATEGORY_COLORS[c]}`}>
            {c} <span className="opacity-60">{catStats[c]}/20</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-[#D4AF37]/30 transition cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/40">Drop MP3 files here or click to browse</p>
        <p className="text-xs text-white/20 mt-1">Supports batch upload. Files are processed sequentially.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Queued files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/60">
              Upload Queue ({files.length} files · {doneCount} done · {errorCount} errors)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleDryRun}
                disabled={processing || pendingCount === 0}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 transition disabled:opacity-30 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Dry Run
              </button>
              <button
                onClick={handleCommit}
                disabled={processing || pendingCount === 0}
                className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-medium hover:bg-[#D4AF37]/25 transition disabled:opacity-30 flex items-center gap-1.5"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {processing ? 'Processing…' : 'Upload & Process'}
              </button>
              <button
                onClick={clearFiles}
                disabled={processing}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10 transition disabled:opacity-30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {files.map((f, i) => {
              const dr = dryRunResults?.[i];
              return (
                <div
                  key={`${f.filename}-${i}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                    f.status === 'done' ? 'bg-emerald-500/5 border border-emerald-500/20' :
                    f.status === 'error' ? 'bg-red-500/5 border border-red-500/20' :
                    'bg-white/[0.02] border border-white/5'
                  }`}
                >
                  <FileAudio className="w-4 h-4 text-white/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 font-medium truncate">{f.filename}</span>
                      {f.durationSec ? (
                        <span className="text-white/30 whitespace-nowrap">{f.durationSec}s <span className="text-emerald-400/70">→ 60s</span></span>
                      ) : null}
                    </div>
                    {dr && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          CATEGORY_COLORS[dr.category] || 'bg-white/10 text-white/40'
                        }`}>{dr.category}</span>
                        <span className="text-white/40">#{dr.sequence}</span>
                        <span className="text-white/40">“{dr.title}”</span>
                        <span className="text-white/30">{dr.energy}</span>
                        <span className="text-white/30">~{dr.bpm}bpm</span>
                        {dr.fillMode === 'trim' && <span className="text-blue-400">✂ trim → 60s</span>}
                        {dr.fillMode === 'loop' && <span className="text-purple-400">↻ loop-fill → 60s</span>}
                        {dr.fillMode === 'exact' && <span className="text-emerald-400">✓ 60s</span>}
                        {dr.duplicate && <span className="text-amber-400">⚠ exists</span>}
                      </div>
                    )}
                    {f.error && <span className="text-red-400 text-[10px]">{f.error}</span>}
                  </div>
                  <div className="shrink-0">
                    {f.status === 'pending' && <span className="text-white/20">Pending</span>}
                    {f.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />}
                    {f.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                    {f.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {f.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing tracks */}
      {fetchedExisting && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60">Library Tracks ({existing.length})</h2>
          {existing.length === 0 ? (
            <p className="text-sm text-white/30 py-8 text-center">No Vol. 2 tracks uploaded yet. Drop your first batch above.</p>
          ) : (
            <div className="space-y-1">
              {existing.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                  <button
                    onClick={() => togglePlay(t.cloudUrl)}
                    className={`p-1.5 rounded-full transition ${
                      playingUrl === t.cloudUrl ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/30 hover:text-white/60'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    CATEGORY_COLORS[t.category] || 'bg-white/10 text-white/40'
                  }`}>{t.category}</span>
                  <span className="text-white/30">#{t.sequence}</span>
                  <span className="text-white/80 font-medium flex-1 truncate">{t.title}</span>
                  <span className={`${t.durationSec === 60 ? 'text-emerald-400/70' : 'text-amber-400'}`}>{t.durationSec}s</span>
                  {t.bpm && <span className="text-white/30">{t.bpm}bpm</span>}
                  <span className="text-white/20">{t.energy}</span>
                  <span className={`px-1 py-0.5 rounded text-[9px] ${t.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {t.isActive ? 'active' : 'disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
