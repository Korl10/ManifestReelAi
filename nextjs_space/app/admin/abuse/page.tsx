'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, Globe, Plus, Trash2, RotateCcw,
  Loader2, CheckCircle, XCircle, Clock, Users, CreditCard, Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';

interface TrialLock {
  id: string;
  email: string;
  cardFingerprint: string | null;
  ipAddressHash: string | null;
  deviceFpHash: string | null;
  trialStartedAt: string;
  trialConsumedAt: string | null;
  trialOutcome: string;
  reelId: string | null;
  subscriptionId: string | null;
  supportOverride: boolean;
  overrideReason: string | null;
  createdAt: string;
}

interface BlockedDomain {
  id: string;
  domain: string;
  source: string;
  createdAt: string;
}

const OUTCOME_BADGES: Record<string, { color: string; icon: typeof CheckCircle }> = {
  PENDING: { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  CONVERTED: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  CANCELLED: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
  EXPIRED: { color: 'text-white/40 bg-white/5', icon: Clock },
};

export default function AbuseAdminPage() {
  const [trialLocks, setTrialLocks] = useState<TrialLock[]>([]);
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
  const [outcomeStats, setOutcomeStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/abuse');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTrialLocks(data.trialLocks || []);
      setBlockedDomains(data.blockedDomains || []);
      setOutcomeStats(data.outcomeStats || {});
    } catch (err) {
      toast.error('Failed to load abuse data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    try {
      const res = await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_domain', domain: newDomain.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Blocked domain: ${newDomain.trim()}`);
      setNewDomain('');
      fetchData();
    } catch {
      toast.error('Failed to add domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (domainId: string) => {
    try {
      await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_domain', domainId }),
      });
      toast.success('Domain removed');
      fetchData();
    } catch {
      toast.error('Failed to remove domain');
    }
  };

  const handleOverride = async (lockId: string) => {
    const reason = prompt('Override reason (for audit log):');
    if (reason === null) return;
    try {
      await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override_lock', lockId, reason }),
      });
      toast.success('Lock overridden');
      fetchData();
    } catch {
      toast.error('Failed to override lock');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield className="w-7 h-7 text-[#D4AF37]" />
          Abuse Prevention
        </h1>
        <p className="text-white/50 mt-1">Trial locks, disposable email blocks, and fingerprint audit log.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['PENDING', 'CONVERTED', 'CANCELLED', 'EXPIRED'] as const).map((outcome) => {
          const badge = OUTCOME_BADGES[outcome];
          const Icon = badge.icon;
          return (
            <motion.div
              key={outcome}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${badge.color.split(' ')[0]}`} />
                <span className="text-white/50 text-xs uppercase tracking-wider">{outcome}</span>
              </div>
              <p className="text-2xl font-bold text-white">{outcomeStats[outcome] || 0}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Blocked Domains */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-red-400" />
          Blocked Email Domains
          <span className="text-white/40 text-sm font-normal">({blockedDomains.length})</span>
        </h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. tempmail.com"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
          />
          <button
            onClick={handleAddDomain}
            disabled={addingDomain || !newDomain.trim()}
            className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {addingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Block
          </button>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {blockedDomains.length === 0 ? (
            <p className="text-white/30 text-sm py-2">No custom blocked domains. The hardcoded top-100 disposable list is always active.</p>
          ) : (
            blockedDomains.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-mono">{d.domain}</span>
                  <span className="text-white/30 text-xs">{d.source}</span>
                </div>
                <button
                  onClick={() => handleRemoveDomain(d.id)}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trial Locks */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#D4AF37]" />
          Trial Locks
          <span className="text-white/40 text-sm font-normal">({trialLocks.length})</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Card FP</th>
                <th className="pb-2 pr-4 hidden lg:table-cell">Device FP</th>
                <th className="pb-2 pr-4">Outcome</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Consumed</th>
                <th className="pb-2 pr-4">Override</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trialLocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-white/30">No trial locks recorded yet.</td>
                </tr>
              ) : (
                trialLocks.map((lock) => {
                  const badge = OUTCOME_BADGES[lock.trialOutcome] || OUTCOME_BADGES.PENDING;
                  return (
                    <tr key={lock.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-4 text-white font-mono text-xs">{lock.email}</td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        {lock.cardFingerprint ? (
                          <span className="text-white/50 font-mono text-xs flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            {lock.cardFingerprint.slice(0, 8)}…
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        {lock.deviceFpHash ? (
                          <span className="text-white/50 font-mono text-xs flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {lock.deviceFpHash.slice(0, 8)}…
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          {lock.trialOutcome}
                        </span>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-white/40 text-xs">
                        {lock.trialConsumedAt ? new Date(lock.trialConsumedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {lock.supportOverride ? (
                          <span className="text-green-400 text-xs" title={lock.overrideReason || ''}>✓ Override</span>
                        ) : (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        {!lock.supportOverride && (
                          <button
                            onClick={() => handleOverride(lock.id)}
                            className="text-white/40 hover:text-[#D4AF37] transition-colors"
                            title="Override lock (allow retry)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
