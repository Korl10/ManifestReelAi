'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, Globe, Plus, Trash2, RotateCcw,
  Loader2, CheckCircle, XCircle, Clock, Users, CreditCard, Smartphone,
  Wifi, MapPin, Filter, Eye,
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
  gateResults: any | null;
  recaptchaScore: number | null;
  ipCountry: string | null;
  createdAt: string;
}

interface BlockedDomain {
  id: string;
  domain: string;
  source: string;
  createdAt: string;
}

interface IpAllowEntry {
  id: string;
  ip: string;
  label: string | null;
  addedBy: string | null;
  createdAt: string;
}

const OUTCOME_BADGES: Record<string, { color: string; icon: typeof CheckCircle }> = {
  PENDING: { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  CONVERTED: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  CANCELLED: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
  EXPIRED: { color: 'text-white/40 bg-white/5', icon: Clock },
};

/** Extract the block reason from gateResults JSON for display. */
function extractBlockReason(lock: TrialLock): string | null {
  if (!lock.gateResults) return null;
  const gates = (lock.gateResults as any)?.gates;
  if (!gates) return null;
  for (const [key, val] of Object.entries(gates)) {
    const v = val as any;
    if (v?.blocked === true || v?.allowed === false) {
      if (key === 'recaptcha' && v.decision === 'block') return 'reCAPTCHA Block';
      if (key === 'ip_scoring' && v.reason) return `IP: ${v.reason}`;
      if (key === 'email_disposable') return 'Disposable Email';
      if (key === 'email_used') return 'Email Reused';
      if (key === 'card_fp') return 'Card Reused';
      if (key === 'device_fp') return 'Device Reused';
      if (key === 'ip_hash') return 'IP Reused';
    }
  }
  return null;
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'recaptcha', label: 'reCAPTCHA' },
  { value: 'ip_scoring', label: 'IP/VPN' },
  { value: 'email', label: 'Email' },
  { value: 'card', label: 'Card' },
  { value: 'device', label: 'Device' },
];

export default function AbuseAdminPage() {
  const [trialLocks, setTrialLocks] = useState<TrialLock[]>([]);
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
  const [ipAllowlist, setIpAllowlist] = useState<IpAllowEntry[]>([]);
  const [outcomeStats, setOutcomeStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newIpLabel, setNewIpLabel] = useState('');
  const [addingIp, setAddingIp] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedLock, setExpandedLock] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/abuse');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTrialLocks(data.trialLocks || []);
      setBlockedDomains(data.blockedDomains || []);
      setIpAllowlist(data.ipAllowlist || []);
      setOutcomeStats(data.outcomeStats || {});
    } catch (err) {
      toast.error('Failed to load abuse data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter trial locks by decision reason
  const filteredLocks = useMemo(() => {
    if (filter === 'all') return trialLocks;
    return trialLocks.filter((lock) => {
      const reason = extractBlockReason(lock);
      if (filter === 'blocked') return reason !== null;
      if (filter === 'recaptcha') return reason?.includes('reCAPTCHA');
      if (filter === 'ip_scoring') return reason?.startsWith('IP:');
      if (filter === 'email') return reason?.includes('Email');
      if (filter === 'card') return reason?.includes('Card');
      if (filter === 'device') return reason?.includes('Device');
      return true;
    });
  }, [trialLocks, filter]);

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

  const handleAddIp = async () => {
    if (!newIp.trim()) return;
    setAddingIp(true);
    try {
      const res = await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_ip', ip: newIp.trim(), label: newIpLabel.trim() || null }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Allowlisted IP: ${newIp.trim()}`);
      setNewIp('');
      setNewIpLabel('');
      fetchData();
    } catch {
      toast.error('Failed to add IP');
    } finally {
      setAddingIp(false);
    }
  };

  const handleRemoveIp = async (ipId: string) => {
    try {
      await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_ip', ipId }),
      });
      toast.success('IP removed from allowlist');
      fetchData();
    } catch {
      toast.error('Failed to remove IP');
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
        <p className="text-white/50 mt-1">Trial locks, disposable email blocks, IP allowlist, and gate audit log.</p>
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

      {/* IP Allowlist (Phase 5D) */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Wifi className="w-5 h-5 text-green-400" />
          IP Allowlist
          <span className="text-white/40 text-sm font-normal">({ipAllowlist.length})</span>
        </h2>
        <p className="text-white/40 text-xs mb-4">Trusted IPs bypass VPN/geo/rate-limit checks during trial signup.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="IP address (e.g. 1.2.3.4)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
          />
          <input
            type="text"
            value={newIpLabel}
            onChange={(e) => setNewIpLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50"
            onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
          />
          <button
            onClick={handleAddIp}
            disabled={addingIp || !newIp.trim()}
            className="flex items-center gap-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {addingIp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Allow
          </button>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {ipAllowlist.length === 0 ? (
            <p className="text-white/30 text-sm py-2">No IPs allowlisted. Add trusted IPs to bypass VPN/geo checks.</p>
          ) : (
            ipAllowlist.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-white text-sm font-mono">{entry.ip}</span>
                  {entry.label && <span className="text-white/40 text-xs">{entry.label}</span>}
                  <span className="text-white/20 text-xs">{new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => handleRemoveIp(entry.id)}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D4AF37]" />
            Trial Locks
            <span className="text-white/40 text-sm font-normal">({filteredLocks.length}{filter !== 'all' ? ` of ${trialLocks.length}` : ''})</span>
          </h2>

          {/* Filter dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/40" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]/50"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0A0A0A]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Card FP</th>
                <th className="pb-2 pr-4 hidden lg:table-cell">Device FP</th>
                <th className="pb-2 pr-4">Outcome</th>
                <th className="pb-2 pr-4">reCAPTCHA</th>
                <th className="pb-2 pr-4">Country</th>
                <th className="pb-2 pr-4">Gate Decision</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Consumed</th>
                <th className="pb-2 pr-4">Override</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-white/30">
                    {filter !== 'all' ? 'No trial locks match this filter.' : 'No trial locks recorded yet.'}
                  </td>
                </tr>
              ) : (
                filteredLocks.map((lock) => {
                  const badge = OUTCOME_BADGES[lock.trialOutcome] || OUTCOME_BADGES.PENDING;
                  const blockReason = extractBlockReason(lock);
                  const isExpanded = expandedLock === lock.id;
                  return (
                    <>
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
                        <td className="py-3 pr-4">
                          {lock.recaptchaScore !== null && lock.recaptchaScore !== undefined ? (
                            <span className={`text-xs font-mono ${
                              lock.recaptchaScore >= 0.5 ? 'text-green-400' :
                              lock.recaptchaScore >= 0.3 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {lock.recaptchaScore.toFixed(2)}
                            </span>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          {lock.ipCountry ? (
                            <span className="text-white/60 text-xs flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lock.ipCountry}
                            </span>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          {blockReason ? (
                            <span className="text-red-400 text-xs bg-red-400/10 px-2 py-0.5 rounded-full">
                              {blockReason}
                            </span>
                          ) : (
                            <span className="text-green-400/60 text-xs">Passed</span>
                          )}
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
                          <div className="flex items-center gap-1">
                            {lock.gateResults && (
                              <button
                                onClick={() => setExpandedLock(isExpanded ? null : lock.id)}
                                className="text-white/40 hover:text-[#D4AF37] transition-colors"
                                title="View full gate log"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {!lock.supportOverride && (
                              <button
                                onClick={() => handleOverride(lock.id)}
                                className="text-white/40 hover:text-[#D4AF37] transition-colors"
                                title="Override lock (allow retry)"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && lock.gateResults && (
                        <tr key={`${lock.id}-expanded`}>
                          <td colSpan={10} className="px-4 py-3 bg-white/[0.02]">
                            <pre className="text-xs text-white/50 font-mono whitespace-pre-wrap overflow-x-auto max-h-64">
                              {JSON.stringify(lock.gateResults, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
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
