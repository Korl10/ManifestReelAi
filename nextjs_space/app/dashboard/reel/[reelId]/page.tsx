'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Download, Calendar, RotateCcw, Copy, Edit3, Save, Loader2, ArrowLeft, Hash, FileText, Type, MessageSquare, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import ReelPlayer from '@/components/reel-player';

export default function ReelPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const reelId = params?.reelId as string;
  const [reel, setReel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('script');
  const [editingCaption, setEditingCaption] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editingHashtags, setEditingHashtags] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState('');
  const [confirmRegen, setConfirmRegen] = useState('');

  useEffect(() => {
    if (!reelId) return;
    fetch(`/api/reels/${reelId}`)
      .then(r => { if (!r.ok) throw new Error('Reel not found'); return r.json(); })
      .then(d => {
        setReel(d);
        setEditCaption(d?.caption ?? '');
        setEditDescription(d?.description ?? '');
        setEditHashtags((d?.hashtags ?? []).join(' '));
      })
      .catch((err) => setError(err?.message ?? 'Failed to load reel'))
      .finally(() => setLoading(false));
  }, [reelId]);

  const handleSave = async (field: 'caption' | 'description' | 'hashtags') => {
    setSaving(true);
    try {
      const payload: any = {};
      if (field === 'caption') payload.caption = editCaption;
      if (field === 'description') payload.description = editDescription;
      if (field === 'hashtags') payload.hashtags = editHashtags.split(/\s+/).filter(Boolean);

      const res = await fetch(`/api/reels/${reelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setReel(data);
      setEditingCaption(false);
      setEditingDescription(false);
      setEditingHashtags(false);
      toast.success('Saved!');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const doRegenerate = async (section: string) => {
    setConfirmRegen('');
    setRegenerating(section);
    try {
      const res = await fetch(`/api/reels/${reelId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });
      if (!res.ok) throw new Error('Regeneration failed');
      const data = await res.json();
      setReel(data);
      setEditCaption(data?.caption ?? '');
      setEditDescription(data?.description ?? '');
      setEditHashtags((data?.hashtags ?? []).join(' '));
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} regenerated!`);
    } catch { toast.error('Regeneration failed. Please try again.'); }
    finally { setRegenerating(''); }
  };

  // Guard all regeneration behind a confirmation dialog (BUG #7 fix).
  const handleRegenerate = (section: string) => {
    setConfirmRegen(section);
  };

  const handleDownload = () => {
    const url = reel?.videoUrl;
    if (!url) { toast.error('Video not ready yet'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(reel?.title ?? 'manifestreel').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  const copyToClipboard = (text: string) => {
    navigator?.clipboard?.writeText?.(text ?? '')?.then(() => toast.success('Copied to clipboard!'))?.catch(() => toast.error('Copy failed'));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
      <p className="text-sm text-white/30">Loading your reel...</p>
    </div>
  );

  if (error || !reel) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-10 h-10 text-red-400/50" />
      <p className="text-white/40 text-sm">{error || 'Reel not found'}</p>
      <button onClick={() => router.push('/dashboard/library')} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-white/50 hover:bg-white/10">Back to Library</button>
    </div>
  );

  const scriptJson = reel?.scriptJson as any;
  const scenesJson = reel?.scenesJson as any;
  const isComposited = !!scenesJson?.composited;
  const costBreakdown = reel?.costBreakdown as any;

  const TABS = [
    { key: 'script', label: 'Script', icon: FileText },
    { key: 'caption', label: 'Caption', icon: MessageSquare },
    { key: 'hashtags', label: 'Hashtags', icon: Hash },
    { key: 'description', label: 'Description', icon: Type },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-4 h-4 text-white/40" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">{reel?.title ?? 'Your Reel'}</h1>
          <p className="text-xs text-white/40">{reel?.style ?? ''} • {reel?.platform ?? ''} • {reel?.mood ?? ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video preview */}
        <div className="lg:col-span-1">
          <ReelPlayer
            videoUrl={reel?.videoUrl}
            posterUrl={reel?.posterUrl ?? reel?.thumbnailUrl}
            musicUrl={reel?.musicUrl}
            hook={scriptJson?.hook}
            script={scriptJson?.fullScript ?? []}
            watermarked={reel?.watermarked}
            title={reel?.title}
            composited={isComposited}
          />
          {reel?.watermarked && (
            <p className="mt-2 text-center text-[10px] text-[#D4AF37]/80">Watermarked • Upgrade to remove</p>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={handleDownload} className="flex-1 py-2.5 rounded-lg gold-gradient text-black font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all">
              <Download className="w-4 h-4" /> Download
            </button>
            <Link href={`/dashboard/reel/${reelId}/schedule`} className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
              <Calendar className="w-4 h-4" /> Schedule
            </Link>
          </div>
        </div>

        {/* Content tabs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/5">
            {TABS.map((tab: any) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.key ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'text-white/40 hover:text-white/60'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
            {activeTab === 'script' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Script</h3>
                  <button onClick={() => handleRegenerate('script')} disabled={!!regenerating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 hover:bg-white/10 transition-all disabled:opacity-50">
                    {regenerating === 'script' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Rewrite
                  </button>
                </div>
                {scriptJson?.hook && <p className="text-[#D4AF37] font-medium text-sm">🎯 Hook: "{scriptJson.hook}"</p>}
                {(scriptJson?.fullScript ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {(scriptJson?.fullScript ?? []).map((line: any, i: number) => (
                      <div key={i} className="flex gap-3 py-2 border-b border-white/5 last:border-0">
                        <span className="text-[10px] text-white/20 font-mono w-12 pt-0.5">{(line?.startTime ?? 0).toFixed(1)}s</span>
                        <p className="text-sm text-white/70 flex-1">{line?.text ?? ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/30">No script data available.</p>
                )}
              </div>
            )}

            {activeTab === 'caption' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Caption</h3>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(reel?.caption ?? '')} className="p-1.5 rounded hover:bg-white/5" title="Copy"><Copy className="w-3.5 h-3.5 text-white/40" /></button>
                    <button onClick={() => setEditingCaption(!editingCaption)} className="p-1.5 rounded hover:bg-white/5" title="Edit"><Edit3 className="w-3.5 h-3.5 text-white/40" /></button>
                  </div>
                </div>
                {editingCaption ? (
                  <div className="space-y-3">
                    <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => handleSave('caption')} disabled={saving} className="px-4 py-2 rounded-lg gold-gradient text-black text-xs font-semibold flex items-center gap-1.5">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </button>
                      <button onClick={() => { setEditingCaption(false); setEditCaption(reel?.caption ?? ''); }} className="px-4 py-2 rounded-lg bg-white/5 text-xs text-white/50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/70 leading-relaxed">{reel?.caption || 'No caption yet.'}</p>
                )}
              </div>
            )}

            {activeTab === 'hashtags' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Hashtags</h3>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard((reel?.hashtags ?? []).join(' '))} className="p-1.5 rounded hover:bg-white/5" title="Copy"><Copy className="w-3.5 h-3.5 text-white/40" /></button>
                    <button onClick={() => setEditingHashtags(!editingHashtags)} className="p-1.5 rounded hover:bg-white/5" title="Edit"><Edit3 className="w-3.5 h-3.5 text-white/40" /></button>
                  </div>
                </div>
                {editingHashtags ? (
                  <div className="space-y-3">
                    <textarea value={editHashtags} onChange={e => setEditHashtags(e.target.value)} rows={3} placeholder="#manifestation #abundance #wealth" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => handleSave('hashtags')} disabled={saving} className="px-4 py-2 rounded-lg gold-gradient text-black text-xs font-semibold flex items-center gap-1.5">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </button>
                      <button onClick={() => { setEditingHashtags(false); setEditHashtags((reel?.hashtags ?? []).join(' ')); }} className="px-4 py-2 rounded-lg bg-white/5 text-xs text-white/50">Cancel</button>
                    </div>
                  </div>
                ) : (reel?.hashtags ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(reel?.hashtags ?? []).map((tag: string, i: number) => (
                      <span key={`${tag}-${i}`} className="px-3 py-1 rounded-full bg-[#7B2FBE]/10 text-[#A855F7] text-xs">{tag}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/30">No hashtags yet.</p>
                )}
              </div>
            )}

            {activeTab === 'description' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Description</h3>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(reel?.description ?? '')} className="p-1.5 rounded hover:bg-white/5" title="Copy"><Copy className="w-3.5 h-3.5 text-white/40" /></button>
                    <button onClick={() => setEditingDescription(!editingDescription)} className="p-1.5 rounded hover:bg-white/5" title="Edit"><Edit3 className="w-3.5 h-3.5 text-white/40" /></button>
                  </div>
                </div>
                {editingDescription ? (
                  <div className="space-y-3">
                    <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => handleSave('description')} disabled={saving} className="px-4 py-2 rounded-lg gold-gradient text-black text-xs font-semibold flex items-center gap-1.5">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </button>
                      <button onClick={() => { setEditingDescription(false); setEditDescription(reel?.description ?? ''); }} className="px-4 py-2 rounded-lg bg-white/5 text-xs text-white/50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/70 leading-relaxed">{reel?.description || 'No description yet.'}</p>
                )}
              </div>
            )}
          </div>

          {/* Regeneration shortcuts */}
          <div className="flex flex-wrap gap-2">
            {['voice', 'music'].map((s: string) => (
              <button
                key={s}
                onClick={() => handleRegenerate(s)}
                disabled={!!regenerating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/50 hover:bg-white/5 hover:text-white/70 transition-all disabled:opacity-50"
              >
                {regenerating === s ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                New {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Confirmation dialog for regeneration */}
          {confirmRegen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setConfirmRegen('')}>
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121212] p-6 text-center" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 mx-auto flex items-center justify-center mb-3">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="font-display text-lg font-bold">Regenerate {confirmRegen}?</h3>
                <p className="text-white/50 text-sm mt-2">
                  This will replace the current {confirmRegen} with a new version. This action cannot be undone.
                </p>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setConfirmRegen('')} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition">Cancel</button>
                  <button
                    onClick={() => doRegenerate(confirmRegen)}
                    className="flex-1 px-4 py-2.5 rounded-xl gold-gradient text-black text-sm font-semibold hover:opacity-90 transition"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cost breakdown (if available) */}
          {costBreakdown && (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
              <h3 className="text-sm font-semibold mb-3">Cost Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(costBreakdown ?? {}).map(([key, val]: [string, any]) => (
                  <div key={key} className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-[10px] text-white/30 uppercase">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-mono text-[#D4AF37]">${(val ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-right">
                <span className="text-xs text-white/30">Total: </span>
                <span className="text-sm font-mono text-[#D4AF37] font-bold">${(reel?.totalCost ?? 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
