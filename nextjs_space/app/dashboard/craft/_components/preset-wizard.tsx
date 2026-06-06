'use client';

import React, { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Check, Upload, Loader2, Image as ImageIcon,
  Palette, Mic2, Clapperboard, Type, Trash2, Music2,
} from 'lucide-react';
import {
  emptyPreset, type BrandPreset, type BrandPresetInput,
  WATERMARK_POSITIONS, WATERMARK_SIZES, ASPECT_RATIOS, PRESET_PLATFORMS,
  REEL_LENGTHS, PRESET_MUSIC_MOODS, type WatermarkPosition, type WatermarkSize,
  type AspectRatio, type PresetPlatform,
} from '@/lib/brand-presets';
import { modelTierAccess, type ModelTierId } from '@/lib/model-tiers';
import type { VoiceTier } from '@/lib/voice-catalog';
import type { SubtitleStyle } from '@/lib/captions/subtitle-types';

const VoiceBrowser = dynamic(() => import('@/components/voice-browser'), { ssr: false });
const ModelTierPicker = dynamic(() => import('@/components/model-tier-picker'), { ssr: false });
const MusicPicker = dynamic(() => import('@/components/music-picker'), { ssr: false });
const SubtitleEditor = dynamic(() => import('@/components/subtitle-editor'), { ssr: false });

const STEPS = [
  { id: 0, label: 'Identity', icon: Palette },
  { id: 1, label: 'Voice & Music', icon: Mic2 },
  { id: 2, label: 'Visual', icon: Clapperboard },
  { id: 3, label: 'Subtitles', icon: Type },
];

function toInput(p: BrandPreset): BrandPresetInput {
  const { id, usageCount, createdAt, updatedAt, ...rest } = p;
  return rest;
}

export function PresetWizard({
  existing, tier, onClose, onSaved, onLimit,
}: {
  existing: BrandPreset | null;
  tier: string;
  onClose: () => void;
  onSaved: () => void;
  onLimit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BrandPresetInput>(() => (existing ? toInput(existing) : emptyPreset()));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allowedModelTiers = useMemo(() => modelTierAccess(tier), [tier]);

  const set = <K extends keyof BrandPresetInput>(key: K, value: BrandPresetInput[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const canSave = form.name.trim().length > 0;

  const handleLogo = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5MB.'); return; }
    setUploading(true);
    try {
      const presign = await fetch('/api/presets/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (presign.status === 403) { onLimit(); return; }
      if (!presign.ok) { setError('Could not start upload.'); return; }
      const { uploadUrl, cloud_storage_path, publicUrl } = await presign.json();
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) { setError('Upload failed. Try again.'); return; }
      setForm(f => ({ ...f, logoPath: cloud_storage_path, logoUrl: publicUrl }));
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!canSave) { setStep(0); return; }
    setSaving(true);
    setError(null);
    try {
      const url = existing ? `/api/presets/${existing.id}` : '/api/presets';
      const method = existing ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (r.status === 403) { onLimit(); return; }
      if (!r.ok) { setError('Could not save preset.'); return; }
      onSaved();
    } catch {
      setError('Could not save preset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
        className="w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col bg-[#101010] sm:rounded-2xl border border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 shrink-0">
          <h2 className="font-display text-lg font-bold">{existing ? 'Edit preset' : 'New brand preset'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step rail */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-white/8 shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    active ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : done ? 'text-white/70 hover:bg-white/5' : 'text-white/40 hover:bg-white/5'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${active ? 'gold-gradient text-black' : done ? 'bg-[#D4AF37]/25 text-[#D4AF37]' : 'bg-white/8 text-white/40'}`}>
                    {done ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 min-h-0">
          {step === 0 && (
            <IdentityStep
              form={form} set={set} uploading={uploading} fileRef={fileRef}
              onPickLogo={() => fileRef.current?.click()}
              onLogoFile={handleLogo}
              onClearLogo={() => setForm(f => ({ ...f, logoPath: null, logoUrl: null }))}
            />
          )}
          {step === 1 && <VoiceMusicStep form={form} set={set} tier={tier} />}
          {step === 2 && <VisualStep form={form} set={set} allowed={allowedModelTiers} />}
          {step === 3 && (
            <div className="max-w-xl">
              <SubtitleEditor
                value={form.subtitleStyle}
                onChange={(s: SubtitleStyle) => set('subtitleStyle', s)}
                previewText={form.ctaText || 'Your abundance is flowing toward you now'}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-5 py-3.5">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/12 text-white/70 text-sm font-medium hover:bg-white/5 transition"
            >
              <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <div className="flex items-center gap-2">
              {!canSave && <span className="text-[11px] text-white/40 hidden sm:block">Name required</span>}
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg gold-gradient text-black text-sm font-semibold hover:opacity-90 transition"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={save}
                  disabled={saving || !canSave}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg gold-gradient text-black text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {existing ? 'Save changes' : 'Create preset'}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Step 1: Identity ---------------- */
function IdentityStep({
  form, set, uploading, fileRef, onPickLogo, onLogoFile, onClearLogo,
}: {
  form: BrandPresetInput;
  set: <K extends keyof BrandPresetInput>(k: K, v: BrandPresetInput[K]) => void;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
  onPickLogo: () => void;
  onLogoFile: (f: File) => void;
  onClearLogo: () => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Field label="Preset name" required>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Abundance Brand, Client X, Wealth Series"
          className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none"
        />
      </Field>

      {/* Logo + colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Brand logo" hint="PNG, SVG, or WebP with transparent background · max 5MB">
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border border-white/10"
              style={{ background: `${form.primaryColor}1a` }}
            >
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Brand logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-6 h-6" style={{ color: form.primaryColor }} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={onPickLogo}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-xs font-medium text-white/75 hover:bg-white/5 transition disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {form.logoUrl ? 'Replace' : 'Upload logo'}
              </button>
              {form.logoUrl && (
                <button onClick={onClearLogo} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-red-400 transition">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/svg+xml,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = ''; }}
            />
          </div>
        </Field>

        <Field label="Brand colors">
          <div className="flex items-center gap-4">
            <ColorSwatch label="Primary" value={form.primaryColor} onChange={v => set('primaryColor', v)} />
            <ColorSwatch label="Accent" value={form.accentColor} onChange={v => set('accentColor', v)} />
            <div
              className="flex-1 h-10 rounded-lg border border-white/10"
              style={{ background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})` }}
            />
          </div>
        </Field>
      </div>

      {/* Watermark */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
        <Toggle
          label="Show watermark on reels"
          desc="Overlay your logo on generated videos"
          checked={form.watermarkShow}
          onChange={v => set('watermarkShow', v)}
        />
        {form.watermarkShow && (<>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <Field label="Position">
              <Segmented
                options={WATERMARK_POSITIONS.map(p => ({ value: p.id, label: p.label }))}
                value={form.watermarkPosition}
                onChange={v => set('watermarkPosition', v as WatermarkPosition)}
                cols={1}
              />
            </Field>
            <Field label="Size">
              <Segmented
                options={WATERMARK_SIZES.map(s => ({ value: s, label: s }))}
                value={form.watermarkSize}
                onChange={v => set('watermarkSize', v as WatermarkSize)}
              />
            </Field>
            <Field label={`Opacity · ${form.watermarkOpacity}%`}>
              <input
                type="range" min={10} max={100} step={5}
                value={form.watermarkOpacity}
                onChange={e => set('watermarkOpacity', Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D4AF37] [&::-webkit-slider-thumb]:cursor-pointer mt-3"
              />
            </Field>
          </div>
          <div className="pt-2">
            <Toggle
              label="Subtle pulse animation"
              desc="Logo gently scales ±5% every ~8s for an organic feel"
              checked={form.watermarkPulse}
              onChange={v => set('watermarkPulse', v)}
            />
          </div>
        </>)}
      </div>

      {/* Metadata defaults */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Default platform">
          <select
            value={form.defaultPlatform}
            onChange={e => set('defaultPlatform', e.target.value as PresetPlatform)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none"
          >
            {PRESET_PLATFORMS.map(p => <option key={p.id} value={p.id} className="bg-[#101010]">{p.label}</option>)}
          </select>
        </Field>
        <Field label="Default length">
          <Segmented
            options={REEL_LENGTHS.map(l => ({ value: String(l.id), label: l.label }))}
            value={String(form.defaultLength)}
            onChange={v => set('defaultLength', Number(v))}
          />
        </Field>
      </div>

      <Field label="Call-to-action text" hint="Optional — appears as an end-card / caption prompt">
        <input
          value={form.ctaText ?? ''}
          onChange={e => set('ctaText', e.target.value)}
          placeholder="e.g. Follow for daily abundance ✨"
          className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none"
        />
      </Field>
    </div>
  );
}

/* ---------------- Step 2: Voice & Music ---------------- */
function VoiceMusicStep({
  form, set, tier,
}: {
  form: BrandPresetInput;
  set: <K extends keyof BrandPresetInput>(k: K, v: BrandPresetInput[K]) => void;
  tier: string;
}) {
  const toggleMood = (m: string) => {
    set('musicMoods', form.musicMoods.includes(m)
      ? form.musicMoods.filter(x => x !== m)
      : [...form.musicMoods, m]);
  };
  const firstMood = form.musicMoods[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white/80 mb-1">Voice lock</h3>
        <p className="text-xs text-white/45 mb-3">Every reel from this preset uses this voice & settings.</p>
        <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4">
          <VoiceBrowser
            selectedVoiceId={form.voiceId ?? ''}
            onSelect={(id: string) => set('voiceId', id)}
            voiceTier={(form.voiceTier as VoiceTier) ?? 'multilingual'}
            onTierChange={(t: VoiceTier) => set('voiceTier', t)}
            stability={form.voiceStability}
            onStabilityChange={(v: number) => set('voiceStability', v)}
            similarity={form.voiceSimilarity}
            onSimilarityChange={(v: number) => set('voiceSimilarity', v)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white/80 mb-1">Music lock</h3>
        <p className="text-xs text-white/45 mb-3">Preferred moods steer the smart matcher; pin a track to always use it.</p>

        <Field label="Preferred moods">
          <div className="flex flex-wrap gap-2">
            {PRESET_MUSIC_MOODS.map(m => {
              const on = form.musicMoods.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => toggleMood(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition border ${
                    on ? 'gold-gradient text-black border-transparent' : 'border-white/12 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-4">
          <Field label="Style tags" hint="Comma-separated, optional (e.g. cinematic, ambient, lo-fi)">
            <input
              value={form.musicStyles.join(', ')}
              onChange={e => set('musicStyles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="cinematic, ambient"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Toggle
            label="Add stinger accent"
            desc="Subtle intro/outro sound on every reel"
            checked={form.stingerEnabled}
            onChange={v => set('stingerEnabled', v)}
          />
        </div>

        <div className="mt-4">
          <Field label="Locked track" hint="Optional — pin one track instead of auto-matching">
            <MusicPicker
              mood={firstMood}
              style={form.musicStyles[0] ?? null}
              platform={form.defaultPlatform}
              value={form.lockedTrackId}
              onChange={(id: string | null) => set('lockedTrackId', id)}
              tier={tier}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 3: Visual ---------------- */
function VisualStep({
  form, set, allowed,
}: {
  form: BrandPresetInput;
  set: <K extends keyof BrandPresetInput>(k: K, v: BrandPresetInput[K]) => void;
  allowed: ModelTierId[];
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Field label="Visual model tier">
        <ModelTierPicker
          value={(form.modelTier as ModelTierId) ?? 'standard'}
          onChange={(id: ModelTierId) => set('modelTier', id)}
          allowed={allowed}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Aspect ratio">
          <Segmented
            options={ASPECT_RATIOS.map(a => ({ value: a.id, label: a.label }))}
            value={form.aspectRatio}
            onChange={v => set('aspectRatio', v as AspectRatio)}
            cols={1}
          />
        </Field>
        <Field label="Motion default">
          <Toggle
            label="Animate scenes by default"
            desc="Use motion / parallax on generated visuals"
            checked={form.motionDefault}
            onChange={v => set('motionDefault', v)}
          />
        </Field>
        <Field label="Subject consistency">
          <Toggle
            label="Lock subject across scenes"
            desc="Keep the same person & look in every shot (recommended for Pro & Cinematic)"
            checked={form.subjectLock !== false}
            onChange={v => set('subjectLock', v)}
          />
        </Field>
      </div>

      <Field label="Visual keywords" hint="Optional — steer the look (e.g. golden hour, luxury, minimal)">
        <textarea
          value={form.visualKeywords ?? ''}
          onChange={e => set('visualKeywords', e.target.value)}
          rows={3}
          placeholder="golden hour, soft bokeh, luxury interiors, warm tones"
          className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none resize-none"
        />
      </Field>
    </div>
  );
}

/* ---------------- Shared UI ---------------- */
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-medium text-white/65">{label}</label>
        {required && <span className="text-[#D4AF37] text-xs">*</span>}
      </div>
      {children}
      {hint && <p className="text-[11px] text-white/35 mt-1.5">{hint}</p>}
    </div>
  );
}

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative w-9 h-9 rounded-lg border border-white/15 overflow-hidden">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="w-full h-full" style={{ backgroundColor: value }} />
      </div>
      <span className="text-[11px] text-white/50">{label}</span>
    </label>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between gap-3 w-full text-left">
      <div>
        <p className="text-sm text-white/80">{label}</p>
        {desc && <p className="text-[11px] text-white/40 mt-0.5">{desc}</p>}
      </div>
      <span className={`relative w-10 h-6 rounded-full shrink-0 transition ${checked ? 'gold-gradient' : 'bg-white/12'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Segmented({ options, value, onChange, cols }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; cols?: number }) {
  return (
    <div className={`grid gap-1.5 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
              on ? 'gold-gradient text-black border-transparent' : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
