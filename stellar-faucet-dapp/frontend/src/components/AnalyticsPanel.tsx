'use client';

import { motion } from 'framer-motion';
import type { FaucetRequest, FaucetStats } from '@/types';
import { useMemo } from 'react';

interface Props {
  history: FaucetRequest[];
  stats: FaucetStats | undefined;
}

export function AnalyticsPanel({ history, stats }: Props) {
  const analytics = useMemo(() => {
    if (!history.length) return null;

    const now = Date.now();
    const last24h = history.filter((r) => now - r.timestamp < 86400_000);
    const totalXlm = history
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);

    // Requests by hour (last 12 hours)
    const byHour: Record<number, number> = {};
    last24h.forEach((r) => {
      const h = new Date(r.timestamp).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(byHour), 1);

    return {
      totalXlm: totalXlm.toFixed(1),
      last24h: last24h.length,
      successRate: Math.round(
        (history.filter((r) => r.status === 'success').length / history.length) * 100
      ),
      byHour,
      maxCount,
    };
  }, [history]);

  if (!analytics) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="glass noise"
        style={{ padding: '1.5rem' }}
      >
        <h3
          className="text-sm font-bold tracking-widest uppercase mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}
        >
          Analytics
        </h3>
        <div className="text-center py-6">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            Make a request to see analytics
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="glass noise relative overflow-hidden"
      style={{ padding: '1.5rem' }}
    >
      <div
        className="absolute bottom-0 left-0 w-24 h-24 pointer-events-none opacity-15"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.6) 0%, transparent 70%)' }}
      />

      <h3
        className="text-sm font-bold tracking-widest uppercase mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}
      >
        Analytics
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <MiniStat label="Total XLM" value={`${analytics.totalXlm}`} unit="XLM" color="#10b981" />
        <MiniStat label="Last 24h" value={String(analytics.last24h)} unit="reqs" color="#60a5fa" />
        <MiniStat
          label="Global"
          value={String(stats?.globalCount ?? '—')}
          unit="total"
          color="#a78bfa"
        />
        <MiniStat label="Success Rate" value={`${analytics.successRate}`} unit="%" color="#f59e0b" />
      </div>

      {/* Mini bar chart */}
      {Object.keys(analytics.byHour).length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            ACTIVITY (24H)
          </p>
          <div className="flex items-end gap-1 h-12">
            {Array.from({ length: 12 }, (_, i) => {
              const h = (new Date().getHours() - 11 + i + 24) % 24;
              const count = analytics.byHour[h] || 0;
              const height = `${Math.max(4, (count / analytics.maxCount) * 100)}%`;
              return (
                <motion.div
                  key={h}
                  initial={{ height: '4%' }}
                  animate={{ height }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className="flex-1 rounded-t"
                  style={{
                    background:
                      count > 0
                        ? 'linear-gradient(to top, #3461f5, #7c3aed)'
                        : 'rgba(255,255,255,0.06)',
                    minWidth: 4,
                  }}
                  title={`${h}:00 — ${count} req`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
              {formatHour((new Date().getHours() - 11 + 24) % 24)}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
              NOW
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: `${color}0f`, border: `1px solid ${color}22` }}
    >
      <p className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
        {label}
      </p>
      <p className="font-bold text-sm mt-0.5" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {value} <span className="text-xs font-normal opacity-70">{unit}</span>
      </p>
    </div>
  );
}

function formatHour(h: number): string {
  return `${h}:00`;
}
