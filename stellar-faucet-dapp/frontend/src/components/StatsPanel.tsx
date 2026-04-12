'use client';

import { motion } from 'framer-motion';
import type { FaucetStats } from '@/types';

interface Props {
  stats: FaucetStats | undefined;
  loading: boolean;
  error?: string;
}

export function StatsPanel({ stats, loading, error }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="glass noise relative overflow-hidden"
      style={{ padding: '1.5rem' }}
    >
      <div
        className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.6) 0%, transparent 70%)',
        }}
      />

      <h3
        className="text-sm font-bold tracking-widest uppercase mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}
      >
        Your Stats
      </h3>

      {error ? (
        <p className="text-xs text-red-400" style={{ fontFamily: 'var(--font-mono)' }}>
          Error loading stats
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <StatRow
            label="Requests Made"
            value={stats?.requestCount}
            loading={loading}
            accent="#60a5fa"
            suffix="times"
          />
          <StatRow
            label="Global Requests"
            value={stats?.globalCount}
            loading={loading}
            accent="#a78bfa"
            suffix="total"
          />
          <StatRow
            label="Faucet Balance"
            value={stats?.contractBalance}
            loading={loading}
            accent="#10b981"
            suffix="XLM"
          />
          <StatRow
            label="Amount / Request"
            value={stats?.faucetAmount}
            loading={loading}
            accent="#f59e0b"
            suffix="XLM"
          />

          {/* Last request */}
          <div
            className="pt-3 mt-1 border-t"
            style={{ borderColor: 'rgba(52,97,245,0.15)' }}
          >
            <p className="text-xs mb-1" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              LAST REQUEST
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
              {loading ? (
                <Skeleton w="80%" />
              ) : stats?.lastRequestTimestamp ? (
                formatRelative(stats.lastRequestTimestamp * 1000)
              ) : (
                <span style={{ color: 'var(--color-muted)' }}>Never</span>
              )}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatRow({
  label,
  value,
  loading,
  accent,
  suffix,
}: {
  label: string;
  value: string | number | undefined;
  loading: boolean;
  accent: string;
  suffix: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-xs"
        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: accent, fontFamily: 'var(--font-mono)' }}>
        {loading ? (
          <Skeleton w="3rem" />
        ) : value !== undefined ? (
          `${value} ${suffix}`
        ) : (
          `—`
        )}
      </span>
    </div>
  );
}

function Skeleton({ w }: { w: string }) {
  return (
    <span
      className="inline-block rounded h-3 opacity-40"
      style={{
        width: w,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}
