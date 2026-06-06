'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Plus, Copy, Pencil, Trash2, Pin, PinOff, Sparkles, Crown,
  Wand2, Image as ImageIcon, Lock, Check,
} from 'lucide-react';
import type { BrandPreset } from '@/lib/brand-presets';
import { PresetWizard } from './_components/preset-wizard';

interface PresetsResponse {
  presets: BrandPreset[];
  tier: string;
  limit: number;
  unlimited: boolean;
  used: number;
  canCreate: boolean;
  limitLabel: string;
}

export default function CraftPage() {
  const router = useRouter();
  const [data, setData] = useState<PresetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<BrandPreset | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BrandPreset | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/presets');
      if (r.ok) setData(await r.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    if (!data?.canCreate) { setUpgradeOpen(true); return; }
    setEditing(null);
    setWizardOpen(true);
  };

  const openEdit = (p: BrandPreset) => {
    setEditing(p);
    setWizardOpen(true);
  };

  const onSaved = async () => {
    setWizardOpen(false);
    setEditing(null);
    setLoading(true);
    await load();
  };

  const duplicate = async (p: BrandPreset) => {
    setBusyId(p.id);
    try {
      const r = await fetch(`/api/presets/${p.id}/duplicate`, { method: 'POST' });
      if (r.status === 403) { setUpgradeOpen(true); return; }
      if (r.ok) { setLoading(true); await load(); }
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (p: BrandPreset) => {
    if (p.isDefault) return;
    setBusyId(p.id);
    try {
      const r = await fetch(`/api/presets/${p.id}/default`, { method: 'POST' });
      if (r.ok) { setLoading(true); await load(); }
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (p: BrandPreset) => {
    setBusyId(p.id);
    try {
      const r = await fetch(`/api/presets/${p.id}`, { method: 'DELETE' });
      if (r.ok) { setConfirmDelete(null); setLoading(true); await load(); }
    } finally {
      setBusyId(null);
    }
  };

  const useForReel = (p: BrandPreset) => {
    router.push(`/dashboard?preset=${p.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center">
              <Palette className="w-5 h-5 text-black" />
            </span>
            <h1 className="font-display text-2xl font-bold">Craft</h1>
          </div>
          <p className="text-white/50 text-sm mt-1.5 max-w-lg">
            Save reusable brand presets &mdash; logo, colors, voice, music & subtitle style &mdash;
            then generate on-brand reels in one click.
          </p>
        </div>
        <button
          onClick={openNew}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gold-gradient text-black text-sm font-semibold hover:opacity-90 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> New Preset
        </button>
      </div>

      {/* Tier banner */}
      {data && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-white/70">
              {data.unlimited
                ? `${data.used} preset${data.used === 1 ? '' : 's'} · unlimited on your plan`
                : `${data.used} / ${data.limit === 0 ? 0 : data.limit} preset${data.limit === 1 ? '' : 's'} used`}
            </span>
          </div>
          {!data.unlimited && (
            <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/8 text-white/60">
              {data.tier} plan
            </span>
          )}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-white/[0.03] border border-white/8 animate-pulse" />
          ))}
        </div>
      ) : !data || data.presets.length === 0 ? (
        <EmptyState tier={data?.tier ?? 'free'} canCreate={data?.canCreate ?? false} onNew={openNew} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.presets.map(p => (
            <PresetCard
              key={p.id}
              preset={p}
              busy={busyId === p.id}
              onUse={() => useForReel(p)}
              onEdit={() => openEdit(p)}
              onDuplicate={() => duplicate(p)}
              onDelete={() => setConfirmDelete(p)}
              onDefault={() => makeDefault(p)}
            />
          ))}
        </div>
      )}

      {/* Wizard */}
      <AnimatePresence>
        {wizardOpen && (
          <PresetWizard
            key="wizard"
            existing={editing}
            tier={data?.tier ?? 'free'}
            onClose={() => { setWizardOpen(false); setEditing(null); }}
            onSaved={onSaved}
            onLimit={() => { setWizardOpen(false); setUpgradeOpen(true); }}
          />
        )}
      </AnimatePresence>

      {/* Upgrade modal */}
      <AnimatePresence>
        {upgradeOpen && (
          <UpgradeModal
            tier={data?.tier ?? 'free'}
            limitLabel={data?.limitLabel ?? 'no presets'}
            onClose={() => setUpgradeOpen(false)}
            onUpgrade={() => router.push('/pricing')}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDelete
            preset={confirmDelete}
            busy={busyId === confirmDelete.id}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => doDelete(confirmDelete)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PresetCard({
  preset, busy, onUse, onEdit, onDuplicate, onDelete, onDefault,
}: {
  preset: BrandPreset;
  busy: boolean;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDefault: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden hover:border-white/15 transition-all"
    >
      {/* Color stripe */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${preset.primaryColor}, ${preset.accentColor})` }}
      />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Logo / fallback */}
          <div
            className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border border-white/10"
            style={{ background: `${preset.primaryColor}1a` }}
          >
            {preset.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preset.logoUrl} alt={`${preset.name} logo`} className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-5 h-5" style={{ color: preset.primaryColor }} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-white truncate">{preset.name || 'Untitled preset'}</h3>
              {preset.isDefault && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-medium">
                  <Pin className="w-2.5 h-2.5" /> Default
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-white/45">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: preset.primaryColor }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: preset.accentColor }} />
              </span>
              <span>&middot;</span>
              <span className="uppercase tracking-wide">{preset.aspectRatio}</span>
              {preset.usageCount > 0 && (<><span>&middot;</span><span>{preset.usageCount} use{preset.usageCount === 1 ? '' : 's'}</span></>)}
            </div>
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Chip>{preset.modelTier} model</Chip>
          {preset.watermarkShow && <Chip>watermark</Chip>}
          {preset.musicMoods.length > 0 && <Chip>{preset.musicMoods.length} mood{preset.musicMoods.length === 1 ? '' : 's'}</Chip>}
          {preset.ctaText ? <Chip>CTA set</Chip> : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onUse}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg gold-gradient text-black text-sm font-semibold hover:opacity-90 transition"
          >
            <Wand2 className="w-3.5 h-3.5" /> Use
          </button>
          <IconBtn title={preset.isDefault ? 'Default preset' : 'Set as default'} onClick={onDefault} disabled={busy || preset.isDefault}>
            {preset.isDefault ? <Pin className="w-4 h-4 text-[#D4AF37]" /> : <PinOff className="w-4 h-4" />}
          </IconBtn>
          <IconBtn title="Edit" onClick={onEdit} disabled={busy}><Pencil className="w-4 h-4" /></IconBtn>
          <IconBtn title="Duplicate" onClick={onDuplicate} disabled={busy}><Copy className="w-4 h-4" /></IconBtn>
          <IconBtn title="Delete" onClick={onDelete} disabled={busy} danger><Trash2 className="w-4 h-4" /></IconBtn>
        </div>
      </div>
    </motion.div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-white/55 capitalize">{children}</span>
  );
}

function IconBtn({
  children, onClick, title, disabled, danger,
}: {
  children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 shrink-0 rounded-lg border border-white/10 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'text-white/50 hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/10' : 'text-white/55 hover:text-white hover:bg-white/8'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ tier, canCreate, onNew }: { tier: string; canCreate: boolean; onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-10 text-center">
      <div className="w-14 h-14 rounded-2xl gold-gradient mx-auto flex items-center justify-center mb-4">
        <Palette className="w-7 h-7 text-black" />
      </div>
      <h3 className="font-display text-lg font-bold">No brand presets yet</h3>
      <p className="text-white/50 text-sm mt-2 max-w-md mx-auto">
        {canCreate
          ? 'Create a preset to lock in your logo, colors, voice, music and subtitle style — then spin up on-brand reels instantly.'
          : 'Brand presets are a paid feature. Upgrade your plan to save your logo, colors, voice and style as reusable presets.'}
      </p>
      <button
        onClick={onNew}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gold-gradient text-black text-sm font-semibold hover:opacity-90 transition"
      >
        {canCreate ? <><Plus className="w-4 h-4" /> Create your first preset</> : <><Crown className="w-4 h-4" /> Upgrade to unlock</>}
      </button>
    </div>
  );
}

function UpgradeModal({
  tier, limitLabel, onClose, onUpgrade,
}: {
  tier: string; limitLabel: string; onClose: () => void; onUpgrade: () => void;
}) {
  return (
    <Backdrop onClose={onClose}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl gold-gradient mx-auto flex items-center justify-center mb-4">
          <Crown className="w-7 h-7 text-black" />
        </div>
        <h3 className="font-display text-xl font-bold">Preset limit reached</h3>
        <p className="text-white/55 text-sm mt-2">
          Your <span className="capitalize text-white/80">{tier}</span> plan includes {limitLabel}.
          Upgrade to <span className="text-[#D4AF37]">Premium</span> for unlimited brand presets.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/12 text-white/70 text-sm font-medium hover:bg-white/5 transition">
            Not now
          </button>
          <button onClick={onUpgrade} className="flex-1 px-4 py-2.5 rounded-xl gold-gradient text-black text-sm font-semibold hover:opacity-90 transition">
            View plans
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function ConfirmDelete({
  preset, busy, onCancel, onConfirm,
}: {
  preset: BrandPreset; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Backdrop onClose={onCancel}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/15 mx-auto flex items-center justify-center mb-4">
          <Trash2 className="w-7 h-7 text-red-400" />
        </div>
        <h3 className="font-display text-xl font-bold">Delete preset?</h3>
        <p className="text-white/55 text-sm mt-2">
          &ldquo;{preset.name || 'Untitled preset'}&rdquo; will be permanently removed. Reels already created keep their settings.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-white/12 text-white/70 text-sm font-medium hover:bg-white/5 transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121212] p-6"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
