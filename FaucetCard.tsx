'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCooldownTimer } from '@/hooks/useFaucet';
import type { FaucetStats, TxStatus } from '@/types';
import { useState } from 'react';

interface Props {
  stats: FaucetStats | undefined;
  statsLoading: boolean;
  txStatus: TxStatus;
  lastTxHash: string | null;
  onRequest: () => void;
  publicKey: string;
}

export function FaucetCard({
  stats,
  statsLoading,
  txStatus,
  lastTxHash,
  onRequest,
  publicKey,
}: Props) {
  const cooldownRemaining = useCooldownTimer(stats?.cooldownRemaining ?? 0);
  const isOnCooldown = cooldownRemaining > 0;
  const isPending = ['signing', 'submitting', 'pending'].includes(txStatus);
  const isDisabled = isPending || isOnCooldown || statsLoading;
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    if (!lastTxHash) return;
    navigator.clipboard.writeText(lastTxHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass noise relative overflow-hidden"
      style={{ padding: '2rem' }}
    >
      {/* Inner glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 30% 0%, rgba(52,97,245,0.3) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10">
        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              className="text-xl font-bold tracking-wider uppercase"
              style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}
            >
              Request Testnet XLM
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              {publicKey.slice(0, 10)}…{publicKey.slice(-6)}
            </p>
          </div>

          {/* Amount badge */}
          <div
            className="px-4 py-2 rounded-xl text-center"
            style={{
              background: 'rgba(52,97,245,0.15)',
              border: '1px solid rgba(52,97,245,0.4)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              PER REQUEST
            </p>
            <p
              className="text-xl font-black gradient-text"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {stats?.faucetAmount ?? '10'} XLM
            </p>
          </div>
        </div>

        {/* Status display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={txStatus}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mb-6 min-h-[52px]"
          >
            <StatusDisplay status={txStatus} txHash={lastTxHash} />
          </motion.div>
        </AnimatePresence>

        {/* Cooldown progress */}
        {isOnCooldown && txStatus === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--color-muted)' }}>Rate limit cooldown</span>
              <span style={{ color: '#f59e0b' }}>{cooldownRemaining}s remaining</span>
            </div>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                  width: `${(cooldownRemaining / 60) * 100}%`,
                }}
                transition={{ duration: 1 }}
              />
            </div>
          </motion.div>
        )}

        {/* Request button */}
        <motion.button
          data-testid="request-faucet-btn"
          whileHover={isDisabled ? {} : { scale: 1.02 }}
          whileTap={isDisabled ? {} : { scale: 0.97 }}
          onClick={onRequest}
          disabled={isDisabled}
          className="relative w-full py-5 rounded-xl font-bold text-white overflow-hidden transition-all"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem',
            letterSpacing: '0.1em',
            background: isOnCooldown
              ? 'rgba(245,158,11,0.15)'
              : isPending
              ? 'rgba(52,97,245,0.2)'
              : 'linear-gradient(135deg, #1f43e8, #3461f5, #7c3aed)',
            border: isOnCooldown
              ? '1px solid rgba(245,158,11,0.4)'
              : isPending
              ? '1px solid rgba(52,97,245,0.4)'
              : 'none',
            boxShadow: isDisabled ? 'none' : 'var(--glow-blue)',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.85 : 1,
          }}
        >
          {/* Shimmer on idle */}
          {!isDisabled && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s infinite',
              }}
            />
          )}

          <span className="relative z-10 flex items-center justify-center gap-3">
            <ButtonContent status={txStatus} isOnCooldown={isOnCooldown} remaining={cooldownRemaining} />
          </span>
        </motion.button>

        {/* Last TX hash */}
        <AnimatePresence>
          {lastTxHash && txStatus !== 'error' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
                    TRANSACTION HASH
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}
                  >
                    {lastTxHash.slice(0, 20)}…{lastTxHash.slice(-10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyHash}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Copy hash"
                  >
                    {copied ? (
                      <CheckIcon />
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="View on explorer"
                  >
                    <ExternalIcon />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function StatusDisplay({ status, txHash }: { status: TxStatus; txHash: string | null }) {
  const configs = {
    idle: null,
    signing: {
      color: '#60a5fa',
      icon: <PulseIcon />,
      label: 'Waiting for signature…',
      sub: 'Please approve in Freighter',
    },
    submitting: {
      color: '#818cf8',
      icon: <SendIcon />,
      label: 'Submitting transaction…',
      sub: 'Broadcasting to Stellar network',
    },
    pending: {
      color: '#a78bfa',
      icon: <SpinnerIcon />,
      label: 'Confirming on-chain…',
      sub: 'Waiting for ledger confirmation',
    },
    success: {
      color: '#10b981',
      icon: <SuccessIcon />,
      label: 'Transaction confirmed!',
      sub: '10 XLM sent to your wallet',
    },
    error: {
      color: '#ef4444',
      icon: <ErrorIcon />,
      label: 'Transaction failed',
      sub: 'Please try again',
    },
  };

  const cfg = configs[status];
  if (!cfg) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: `${cfg.color}14`,
        border: `1px solid ${cfg.color}33`,
      }}
    >
      <span style={{ color: cfg.color }}>{cfg.icon}</span>
      <div>
        <p className="text-sm font-medium" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
          {cfg.sub}
        </p>
      </div>
    </div>
  );
}

function ButtonContent({
  status,
  isOnCooldown,
  remaining,
}: {
  status: TxStatus;
  isOnCooldown: boolean;
  remaining: number;
}) {
  if (isOnCooldown && status === 'idle') {
    return (
      <>
        <ClockIcon />
        COOLDOWN — {remaining}s
      </>
    );
  }
  switch (status) {
    case 'signing':    return <><PulseIcon /> SIGN IN FREIGHTER…</>;
    case 'submitting': return <><SendIcon /> SUBMITTING…</>;
    case 'pending':    return <><SpinnerIcon /> CONFIRMING…</>;
    case 'success':    return <><SuccessIcon /> SUCCESS!</>;
    case 'error':      return <><ErrorIcon /> RETRY REQUEST</>;
    default:           return <>✦ REQUEST TESTNET XLM</>;
  }
}

// ── Icon set ──────────────────────────────────
function SpinnerIcon() {
  return <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>;
}
function PulseIcon() {
  return <span className="inline-block w-3 h-3 rounded-full bg-blue-400" style={{ animation: 'pulse 1s infinite' }} />;
}
function SendIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>;
}
function SuccessIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;
}
function ErrorIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}
function ClockIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>;
}
function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;
}
function ExternalIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
}
