'use client';
import React from 'react';
import { Activity, Loader2, RefreshCw } from 'lucide-react';

type QueueRow = {
  family: string;
  label: string;
  limit: number;
  configuredLimit: number;
  active: number;
  queued: number;
  avgTaskSec: number;
  throughputPerHour: number;
  estWaitSec: number;
};

export default function AdminOpsPage() {
  const [rows, setRows] = React.useState<QueueRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generatedAt, setGeneratedAt] = React.useState<string>('');

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ops', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.queues ?? []);
      setGeneratedAt(data.generatedAt ?? '');
    } catch {
      /* ignore transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 5000); // auto-refresh every 5s
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#D4AF37]" />
          <div>
            <h1 className="text-xl font-semibold">Render Operations</h1>
            <p className="text-sm text-white/40">Live model queue depth, wait times &amp; throughput</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-sm text-white/60 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rows.map((r) => {
            const saturated = r.active >= r.limit && r.queued > 0;
            return (
              <div
                key={r.family}
                className={`rounded-xl border p-5 bg-white/[0.02] ${
                  saturated ? 'border-amber-500/40' : 'border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white/80">{r.label}</h3>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      saturated ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {saturated ? 'Saturated' : 'Healthy'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Active" value={`${r.active} / ${r.limit}`} />
                  <Stat label="In queue" value={`${r.queued}`} />
                  <Stat label="Avg task" value={`${r.avgTaskSec}s`} />
                  <Stat label="Est. wait" value={`${r.estWaitSec}s`} />
                  <Stat label="Done / hr" value={`${r.throughputPerHour}`} />
                  <Stat label="Limit (env)" value={`${r.configuredLimit}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {generatedAt && (
        <p className="text-[11px] text-white/30 mt-6">
          Updated {new Date(generatedAt).toLocaleTimeString()} · auto-refreshes every 5s
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/40 text-[11px] uppercase tracking-wide">{label}</div>
      <div className="text-white/90 font-semibold mt-0.5">{value}</div>
    </div>
  );
}
