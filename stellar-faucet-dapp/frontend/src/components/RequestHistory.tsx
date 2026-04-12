'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { FaucetRequest } from '@/types';
import { useState } from 'react';

interface Props {
  history: FaucetRequest[];
}

export function RequestHistory({ history }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(hash);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass noise relative overflow-hidden"
      style={{ padding: '1.5rem' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-bold tracking-widest uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}
        >
          Request History
        </h3>
        {history.length > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{
              background: 'rgba(52,97,245,0.15)',
              border: '1px solid rgba(52,97,245,0.3)',
              color: '#60a5fa',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {history.length}
          </span>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">🪐</p>
          <p className="text-sm" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            No requests yet
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {history.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{
                  background:
                    req.status === 'success'
                      ? 'rgba(16,185,129,0.07)'
                      : 'rgba(239,68,68,0.07)',
                  border: `1px solid ${
                    req.status === 'success'
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(239,68,68,0.2)'
                  }`,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span style={{ fontSize: '0.75rem' }}>
                    {req.status === 'success' ? '✅' : '❌'}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{
                        color: req.status === 'success' ? '#10b981' : '#ef4444',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      +{req.amount} XLM
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {req.txHash.slice(0, 12)}…{req.txHash.slice(-6)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {formatTime(req.timestamp)}
                  </span>
                  <button
                    onClick={() => copy(req.txHash)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    title="Copy hash"
                  >
                    {copiedId === req.txHash ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-muted)' }}>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${req.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-muted)' }}>
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15,3 21,3 21,9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
