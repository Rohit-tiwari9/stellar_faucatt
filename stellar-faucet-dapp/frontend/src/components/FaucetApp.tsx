'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────
type TxStatus = 'idle' | 'signing' | 'submitting' | 'pending' | 'success' | 'error';

interface FaucetRequest {
  id: string;
  txHash: string;
  amount: string;
  timestamp: number;
  status: 'success' | 'error';
  address: string;
}

interface FaucetStats {
  lastRequestTimestamp: number | null;
  requestCount: number;
  globalCount: number;
  cooldownRemaining: number;
  faucetAmount: string;
  contractBalance: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  QUERY KEY FACTORY — single source of truth
//  Using the same factory in both useQuery and invalidateQueries guarantees
//  the keys match exactly and invalidation always triggers a refetch.
// ─────────────────────────────────────────────────────────────────────────────
const QK = {
  stats:   (addr: string) => ['faucetStats',   addr] as const,
  history: (addr: string) => ['faucetHistory', addr] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
//  LOCAL STATS STORE
//  Persists counters in localStorage so stats reflect real state between
//  renders. Replace `fetchLocalStats` with your real RPC call once deployed.
// ─────────────────────────────────────────────────────────────────────────────
const COOLDOWN_SECONDS = 60;
const DRIP_XLM         = 10;
const INITIAL_BALANCE  = 5000;
const STATS_KEY        = 'faucet_stats_v1';

interface PersistedStats {
  requestCount: number;
  globalCount: number;
  lastRequestAt: number | null; // unix seconds
  balance: number;
}

function readPersistedStats(): PersistedStats {
  if (typeof window === 'undefined') return defaultPersistedStats();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? (JSON.parse(raw) as PersistedStats) : defaultPersistedStats();
  } catch { return defaultPersistedStats(); }
}

function defaultPersistedStats(): PersistedStats {
  return { requestCount: 0, globalCount: 0, lastRequestAt: null, balance: INITIAL_BALANCE };
}

function writePersistedStats(s: PersistedStats) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Called immediately after a successful request — updates counts + balance. */
function applySuccessToStats(): PersistedStats {
  const prev = readPersistedStats();
  const next: PersistedStats = {
    requestCount: prev.requestCount + 1,
    globalCount:  prev.globalCount  + 1,
    lastRequestAt: Math.floor(Date.now() / 1000),
    balance: Math.max(0, prev.balance - DRIP_XLM),
  };
  writePersistedStats(next);
  return next;
}

/** Derives FaucetStats from persisted data, computing live cooldown. */
function deriveStats(p: PersistedStats): FaucetStats {
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = p.lastRequestAt ? nowSec - p.lastRequestAt : COOLDOWN_SECONDS;
  const cooldown = Math.max(0, COOLDOWN_SECONDS - elapsed);
  return {
    lastRequestTimestamp: p.lastRequestAt,
    requestCount:         p.requestCount,
    globalCount:          p.globalCount,
    cooldownRemaining:    cooldown,
    faucetAmount:         DRIP_XLM.toFixed(1),
    contractBalance:      p.balance.toFixed(1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FREIGHTER HOOK  (Freighter API v5+ — no window.freighter)
// ─────────────────────────────────────────────────────────────────────────────
const WALLET_KEY = 'faucet_wallet';

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  network:   string | null;
  loading:   boolean;
  error:     string | null;
  installed: boolean | null;
}

function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false, publicKey: null, network: null,
    loading: false, error: null, installed: null,
  });

  const getApi = useCallback(() => import('@stellar/freighter-api'), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const api = await getApi();
        const { isConnected } = await api.isConnected();
        if (!isConnected) { setState(s => ({ ...s, installed: false })); return; }
        setState(s => ({ ...s, installed: true }));

        const saved = localStorage.getItem(WALLET_KEY);
        if (!saved) return;

        const { isAllowed } = await api.isAllowed();
        if (!isAllowed) { localStorage.removeItem(WALLET_KEY); return; }

        const addrResult = await api.getAddress();
        const address = (addrResult as any).address ?? (addrResult as any).publicKey ?? null;
        if (!address || address !== saved) { localStorage.removeItem(WALLET_KEY); return; }

        const netResult = await api.getNetwork();
        setState(s => ({ ...s, connected: true, publicKey: address, network: (netResult as any).network ?? 'TESTNET' }));
      } catch { setState(s => ({ ...s, installed: false })); }
    })();
  }, [getApi]);

  const connect = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const api = await getApi();
      const { isConnected } = await api.isConnected();
      if (!isConnected) throw new Error('Freighter not found — install it at freighter.app');

      const accessResult = await api.requestAccess();
      const address = (accessResult as any).address ?? (accessResult as any).publicKey ?? null;
      if (!address) throw new Error('No address returned from Freighter');

      const netResult = await api.getNetwork();
      localStorage.setItem(WALLET_KEY, address);
      setState({ connected: true, publicKey: address, network: (netResult as any).network ?? 'TESTNET', loading: false, error: null, installed: true });
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err?.message ?? 'Failed to connect' }));
    }
  }, [getApi]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(WALLET_KEY);
    setState(s => ({ connected: false, publicKey: null, network: null, loading: false, error: null, installed: s.installed }));
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const api = await getApi();
    const passphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
    const result = await api.signTransaction(xdr, { networkPassphrase: passphrase } as any);
    const signed = (result as any).signedTxXdr ?? (result as any).result ?? null;
    if (!signed) throw new Error('Signing failed or was rejected');
    return signed;
  }, [getApi]);

  return {
    ...state,
    shortAddress: state.publicKey ? `${state.publicKey.slice(0, 6)}…${state.publicKey.slice(-4)}` : null,
    connect, disconnect, signTransaction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOCAL HISTORY
// ─────────────────────────────────────────────────────────────────────────────
const histKey = (addr: string) => `faucet_history_${addr}`;

function loadHistory(addr: string): FaucetRequest[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(histKey(addr)) ?? '[]'); } catch { return []; }
}

function appendHistory(addr: string, entry: FaucetRequest): FaucetRequest[] {
  const updated = [entry, ...loadHistory(addr)].slice(0, 50);
  try { localStorage.setItem(histKey(addr), JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
//  REACT QUERY HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useFaucetStats(publicKey: string | null) {
  return useQuery<FaucetStats>({
    queryKey: QK.stats(publicKey ?? ''),   // ← uses QK factory
    enabled:  !!publicKey,
    queryFn: async (): Promise<FaucetStats> => {
      // ── Swap this for your real RPC call ─────────────────────────────────
      // import { fetchFaucetStats } from '@/lib/stellar';
      // return fetchFaucetStats(publicKey!);
      // ─────────────────────────────────────────────────────────────────────
      return deriveStats(readPersistedStats());
    },
    refetchInterval: 5_000,
    // staleTime: 0 + gcTime: 0 forces React Query to always hit queryFn
    // after invalidateQueries, not serve the stale cache.
    staleTime: 0,
    gcTime:    0,
    retry: 1,
  });
}

function useRequestHistory(publicKey: string | null) {
  return useQuery<FaucetRequest[]>({
    queryKey: QK.history(publicKey ?? ''),  // ← uses QK factory
    queryFn:  () => (publicKey ? loadHistory(publicKey) : []),
    enabled:  !!publicKey,
    staleTime: Infinity,
  });
}

function useFaucetRequest(
  publicKey: string | null,
  signTransaction: (xdr: string) => Promise<string>,
) {
  const queryClient = useQueryClient();
  const [txStatus,   setTxStatus]   = useState<TxStatus>('idle');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [txError,    setTxError]    = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error('Wallet not connected');
      setTxStatus('signing');
      setTxError(null);

      // ── Swap this for your real contract call ─────────────────────────────
      // import { requestFaucetFunds } from '@/lib/stellar';
      // setTxStatus('submitting');
      // return requestFaucetFunds(publicKey, signTransaction);
      // ─────────────────────────────────────────────────────────────────────
      await new Promise(r => setTimeout(r, 900));
      setTxStatus('submitting');
      await new Promise(r => setTimeout(r, 700));
      setTxStatus('pending');
      await new Promise(r => setTimeout(r, 1_000));
      const hash = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
      return { txHash: hash, amountXlm: DRIP_XLM };
    },

    onSuccess: ({ txHash, amountXlm }) => {
      if (!publicKey) return;

      // STEP 1 — Persist the updated stats to localStorage BEFORE invalidating.
      applySuccessToStats();

      // STEP 2 — Invalidate stats using the EXACT same key factory.
      //          React Query will call queryFn immediately, which reads the
      //          freshly-updated localStorage and returns the correct numbers.
      queryClient.invalidateQueries({ queryKey: QK.stats(publicKey) });

      // STEP 3 — Update history cache directly (no round-trip needed).
      const entry: FaucetRequest = {
        id: txHash, txHash,
        amount: amountXlm.toFixed(1),
        timestamp: Date.now(),
        status: 'success',
        address: publicKey,
      };
      const updatedHistory = appendHistory(publicKey, entry);
      queryClient.setQueryData(QK.history(publicKey), updatedHistory);

      setTxStatus('success');
      setLastTxHash(txHash);
      setTimeout(() => setTxStatus('idle'), 5_000);
    },

    onError: (err: Error) => {
      setTxStatus('error');
      setTxError(err.message ?? 'Transaction failed');
      setTimeout(() => setTxStatus('idle'), 4_000);
    },
  });

  return {
    requestFunds: () => mutation.mutate(),
    status: txStatus,
    lastTxHash,
    error: txError,
  };
}

/** Ticks independently every second — keeps the cooldown display live. */
function useCooldownTimer(serverRemaining: number) {
  const [remaining, setRemaining] = useState(serverRemaining);
  useEffect(() => { setRemaining(serverRemaining); }, [serverRemaining]);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1_000);
    return () => clearInterval(id);
  }, [remaining]);
  return remaining;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ICONS
// ─────────────────────────────────────────────────────────────────────────────
function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>;
}
function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
}
function ExternalIcon({ color = 'currentColor' }: { color?: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15,3 21,3 21,9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HEADER
// ─────────────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center pt-4 pb-2">
      <div className="flex items-center justify-center gap-3 mb-3">
        <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="text-3xl select-none">✦</motion.span>
        <h1 className="gradient-text text-4xl md:text-5xl font-black tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)' }}>Stellar Faucet</h1>
        <motion.span animate={{ rotate: [360, 0] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="text-3xl select-none">✦</motion.span>
      </div>
      <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
        Soroban Smart Contract · Testnet · Rate Limited
      </p>
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
        className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full text-xs"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'pulse 2s infinite' }} />
        TESTNET ACTIVE
      </motion.div>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function WalletButton({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  const [open, setOpen] = useState(false);

  if (wallet.installed === null) {
    return (
      <button disabled className="px-5 py-2.5 rounded-xl text-sm opacity-50"
        style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)' }}>
        Detecting wallet…
      </button>
    );
  }
  if (wallet.installed === false) {
    return (
      <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
        className="px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontFamily: 'var(--font-display)', fontSize: '0.72rem', letterSpacing: '0.06em', textDecoration: 'none' }}>
        Install Freighter →
      </a>
    );
  }
  if (!wallet.connected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={wallet.connect} disabled={wallet.loading} data-testid="connect-wallet-btn"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', letterSpacing: '0.06em', background: 'linear-gradient(135deg,rgba(52,97,245,0.2),rgba(124,58,237,0.2))', border: '1px solid rgba(52,97,245,0.5)', backdropFilter: 'blur(10px)' }}>
          {wallet.loading ? <><SpinnerIcon size={14} /> Connecting…</> : '⬡ CONNECT WALLET'}
        </motion.button>
        {wallet.error && <p className="text-xs text-red-400" style={{ fontFamily: 'var(--font-mono)' }}>{wallet.error}</p>}
      </div>
    );
  }

  return (
    <div className="relative">
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(v => !v)} data-testid="wallet-connected-btn"
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
        style={{ background: 'rgba(13,16,47,0.8)', border: '1px solid rgba(16,185,129,0.4)', backdropFilter: 'blur(10px)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-text)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
        <span style={{ color: '#10b981' }}>{wallet.shortAddress}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-50"
              style={{ background: 'rgba(7,8,26,0.97)', border: '1px solid rgba(52,97,245,0.3)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(52,97,245,0.12)' }}>
                <p className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>Connected</p>
                <p className="mt-1 break-all" style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>{wallet.publicKey}</p>
                {wallet.network && <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{wallet.network}</p>}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(wallet.publicKey ?? ''); setOpen(false); toast.success('Address copied!'); }}
                className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-white/5 transition-colors" style={{ color: 'var(--color-text)', fontSize: '0.8rem' }}>
                <CopyIcon /> Copy Address
              </button>
              <button onClick={() => { window.open(`https://stellar.expert/explorer/testnet/account/${wallet.publicKey}`, '_blank'); setOpen(false); }}
                className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-white/5 transition-colors" style={{ color: 'var(--color-text)', fontSize: '0.8rem' }}>
                <ExternalIcon /> View on Explorer
              </button>
              <div style={{ borderTop: '1px solid rgba(52,97,245,0.12)' }}>
                <button onClick={() => { wallet.disconnect(); setOpen(false); }}
                  className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-red-500/10 transition-colors" style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Disconnect
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FAUCET CARD
// ─────────────────────────────────────────────────────────────────────────────
function FaucetCard({ stats, statsLoading, txStatus, lastTxHash, onRequest, publicKey }: {
  stats: FaucetStats | undefined; statsLoading: boolean; txStatus: TxStatus;
  lastTxHash: string | null; onRequest: () => void; publicKey: string;
}) {
  const cooldown     = useCooldownTimer(stats?.cooldownRemaining ?? 0);
  const isOnCooldown = cooldown > 0;
  const isPending    = ['signing', 'submitting', 'pending'].includes(txStatus);
  const isDisabled   = isPending || isOnCooldown || statsLoading;
  const [copied, setCopied] = useState(false);
  const copyHash = () => { if (!lastTxHash) return; navigator.clipboard.writeText(lastTxHash); setCopied(true); setTimeout(() => setCopied(false), 2_000); };

  const statusCfg: Record<TxStatus, { color: string; label: string; sub: string } | null> = {
    idle: null,
    signing:    { color: '#60a5fa', label: 'Waiting for signature…',  sub: 'Please approve in Freighter' },
    submitting: { color: '#818cf8', label: 'Submitting transaction…', sub: 'Broadcasting to Stellar network' },
    pending:    { color: '#a78bfa', label: 'Confirming on-chain…',    sub: 'Waiting for ledger confirmation' },
    success:    { color: '#10b981', label: 'Transaction confirmed!',  sub: '10 XLM sent to your wallet' },
    error:      { color: '#ef4444', label: 'Transaction failed',      sub: 'Please try again' },
  };
  const btnLabel: Record<TxStatus, string> = {
    idle: '✦ REQUEST TESTNET XLM', signing: '◉ SIGN IN FREIGHTER…',
    submitting: '→ SUBMITTING…', pending: '⟳ CONFIRMING…', success: '✓ SUCCESS!', error: '✦ RETRY',
  };
  const cfg = statusCfg[txStatus];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="glass noise relative overflow-hidden" style={{ padding: '2rem' }}>
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse at 30% 0%,rgba(52,97,245,0.3) 0%,transparent 60%)' }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold tracking-wider uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>Request Testnet XLM</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{publicKey.slice(0, 10)}…{publicKey.slice(-6)}</p>
          </div>
          <div className="px-4 py-2 rounded-xl text-center" style={{ background: 'rgba(52,97,245,0.15)', border: '1px solid rgba(52,97,245,0.4)' }}>
            <p style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem' }}>PER REQUEST</p>
            <p className="text-xl font-black gradient-text" style={{ fontFamily: 'var(--font-display)' }}>{stats?.faucetAmount ?? '10'} XLM</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {cfg && (
            <motion.div key={txStatus} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: `${cfg.color}14`, border: `1px solid ${cfg.color}33` }}>
              <span style={{ color: cfg.color }}>{isPending ? <SpinnerIcon size={16} /> : txStatus === 'success' ? <CheckIcon /> : '✕'}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{cfg.sub}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isOnCooldown && txStatus === 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--color-muted)' }}>Rate limit cooldown</span>
              <span style={{ color: '#f59e0b' }}>{cooldown}s remaining</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)', width: `${(cooldown / COOLDOWN_SECONDS) * 100}%` }} />
            </div>
          </motion.div>
        )}

        <motion.button data-testid="request-faucet-btn"
          whileHover={isDisabled ? {} : { scale: 1.02 }} whileTap={isDisabled ? {} : { scale: 0.97 }}
          onClick={onRequest} disabled={isDisabled}
          className="relative w-full py-5 rounded-xl font-bold text-white overflow-hidden"
          style={{
            fontFamily: 'var(--font-display)', fontSize: '0.82rem', letterSpacing: '0.1em',
            background: isOnCooldown ? 'rgba(245,158,11,0.14)' : isPending ? 'rgba(52,97,245,0.18)' : 'linear-gradient(135deg,#1f43e8,#3461f5,#7c3aed)',
            border: isOnCooldown ? '1px solid rgba(245,158,11,0.4)' : isPending ? '1px solid rgba(52,97,245,0.4)' : 'none',
            boxShadow: isDisabled ? 'none' : 'var(--glow-blue)',
            cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.85 : 1,
          }}>
          {!isDisabled && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.08) 50%,transparent 70%)', backgroundSize: '200% 100%', animation: 'shimmer 3s infinite' }} />
          )}
          <span className="relative z-10 flex items-center justify-center gap-3">
            {isOnCooldown && txStatus === 'idle' ? `⏱ COOLDOWN — ${cooldown}s` : btnLabel[txStatus]}
          </span>
        </motion.button>

        <AnimatePresence>
          {lastTxHash && txStatus !== 'error' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div>
                  <p style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem' }}>TRANSACTION HASH</p>
                  <p className="text-xs mt-0.5" style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>{lastTxHash.slice(0, 20)}…{lastTxHash.slice(-10)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={copyHash} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: '#10b981' }}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    <ExternalIcon color="#10b981" />
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

// ─────────────────────────────────────────────────────────────────────────────
//  STATS PANEL  — AnimatePresence on each value so updates animate in
// ─────────────────────────────────────────────────────────────────────────────
function StatsPanel({ stats, loading, error }: { stats: FaucetStats | undefined; loading: boolean; error?: string }) {
  const rows = [
    { label: 'Requests Made',   value: stats?.requestCount,    accent: '#60a5fa', suffix: 'times' },
    { label: 'Global Requests', value: stats?.globalCount,     accent: '#a78bfa', suffix: 'total' },
    { label: 'Faucet Balance',  value: stats?.contractBalance, accent: '#10b981', suffix: 'XLM'   },
    { label: 'Amount/Request',  value: stats?.faucetAmount,    accent: '#f59e0b', suffix: 'XLM'   },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
      className="glass noise relative overflow-hidden" style={{ padding: '1.5rem' }}>
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle,rgba(124,58,237,0.6) 0%,transparent 70%)' }} />
      <h3 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}>Your Stats</h3>
      {error ? (
        <p className="text-xs text-red-400" style={{ fontFamily: 'var(--font-mono)' }}>Error loading stats</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid rgba(52,97,245,0.08)' }}>
              <span className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{row.label}</span>
              <AnimatePresence mode="wait">
                <motion.span key={`${row.label}-${row.value}`}
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.25 }}
                  className="text-sm font-semibold" style={{ color: row.accent, fontFamily: 'var(--font-mono)' }}>
                  {loading ? '…' : row.value !== undefined ? `${row.value} ${row.suffix}` : '—'}
                </motion.span>
              </AnimatePresence>
            </div>
          ))}
          <div className="pt-1">
            <p className="text-xs mb-1" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>LAST REQUEST</p>
            <AnimatePresence mode="wait">
              <motion.p key={String(stats?.lastRequestTimestamp)}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-sm" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                {loading ? '…' : stats?.lastRequestTimestamp
                  ? formatRelative(stats.lastRequestTimestamp * 1000)
                  : <span style={{ color: 'var(--color-muted)' }}>Never</span>}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function formatRelative(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
//  REQUEST HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function RequestHistory({ history }: { history: FaucetRequest[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = (hash: string) => { navigator.clipboard.writeText(hash); setCopiedId(hash); setTimeout(() => setCopiedId(null), 1_500); };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="glass noise relative overflow-hidden" style={{ padding: '1.5rem' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}>Request History</h3>
        {history.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'rgba(52,97,245,0.15)', border: '1px solid rgba(52,97,245,0.3)', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
            {history.length}
          </span>
        )}
      </div>
      {history.length === 0 ? (
        <div className="text-center py-8"><p className="text-3xl mb-2">🪐</p><p className="text-sm" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>No requests yet</p></div>
      ) : (
        <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {history.map((req, i) => (
              <motion.div key={req.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: req.status === 'success' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)', border: `1px solid ${req.status === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span>{req.status === 'success' ? '✅' : '❌'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: req.status === 'success' ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>+{req.amount} XLM</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{req.txHash.slice(0, 12)}…{req.txHash.slice(-6)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{formatTime(req.timestamp)}</span>
                  <button onClick={() => copy(req.txHash)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: copiedId === req.txHash ? '#10b981' : 'var(--color-muted)' }}>
                    {copiedId === req.txHash ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${req.txHash}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/10 transition-colors">
                    <ExternalIcon />
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
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; return `${Math.floor(s / 3600)}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ANALYTICS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsPanel({ history, stats }: { history: FaucetRequest[]; stats: FaucetStats | undefined }) {
  if (!history.length) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass noise" style={{ padding: '1.5rem' }}>
        <h3 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}>Analytics</h3>
        <div className="text-center py-6"><p className="text-2xl mb-2">📊</p><p className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>Make a request to see analytics</p></div>
      </motion.div>
    );
  }
  const now = Date.now();
  const last24h = history.filter(r => now - r.timestamp < 86_400_000);
  const totalXlm = history.filter(r => r.status === 'success').reduce((s, r) => s + parseFloat(r.amount ?? '0'), 0);
  const successRate = Math.round((history.filter(r => r.status === 'success').length / history.length) * 100);
  const byHour: Record<number, number> = {};
  last24h.forEach(r => { const h = new Date(r.timestamp).getHours(); byHour[h] = (byHour[h] ?? 0) + 1; });
  const maxCount = Math.max(...Object.values(byHour), 1);
  const miniStats = [
    { label: 'Total XLM', value: `${totalXlm.toFixed(1)} XLM`, color: '#10b981' },
    { label: 'Last 24h',  value: `${last24h.length} reqs`,      color: '#60a5fa' },
    { label: 'Global',    value: `${stats?.globalCount ?? '—'}`, color: '#a78bfa' },
    { label: 'Success',   value: `${successRate}%`,              color: '#f59e0b' },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass noise relative overflow-hidden" style={{ padding: '1.5rem' }}>
      <h3 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-muted)' }}>Analytics</h3>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {miniStats.map(s => (
          <div key={s.label} className="rounded-lg px-3 py-2" style={{ background: `${s.color}0f`, border: `1px solid ${s.color}22` }}>
            <p style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem' }}>{s.label}</p>
            <AnimatePresence mode="wait">
              <motion.p key={s.value} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="font-bold text-sm mt-0.5" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}
              </motion.p>
            </AnimatePresence>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', marginBottom: 6 }}>ACTIVITY (24H)</p>
      <div className="flex items-end gap-1 h-12">
        {Array.from({ length: 12 }, (_, i) => {
          const h = (new Date().getHours() - 11 + i + 24) % 24;
          const count = byHour[h] ?? 0;
          return (
            <motion.div key={h} initial={{ height: '4%' }} animate={{ height: `${Math.max(4, (count / maxCount) * 100)}%` }} transition={{ delay: i * 0.04, duration: 0.4 }}
              className="flex-1 rounded-t" style={{ background: count > 0 ? 'linear-gradient(to top,#3461f5,#7c3aed)' : 'rgba(255,255,255,0.06)', minWidth: 4 }} title={`${h}:00 — ${count} req`} />
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONNECT PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function ConnectPrompt({ onConnect, loading }: { onConnect: () => void; loading: boolean }) {
  return (
    <motion.div className="glass noise relative overflow-hidden p-12 text-center" style={{ minHeight: 420 }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,rgba(52,97,245,1) 0%,transparent 70%)', animation: 'pulse 4s ease-in-out infinite' }} />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'rgba(52,97,245,0.5)' }}>
          <span className="text-4xl select-none">✦</span>
        </motion.div>
        <div>
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
            <span className="gradient-text">Connect Your Wallet</span>
          </h2>
          <p className="text-base max-w-sm mx-auto" style={{ color: 'var(--color-muted)' }}>
            Connect your Freighter wallet to request testnet XLM via our Soroban smart contract faucet.
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={onConnect} disabled={loading}
          className="relative px-10 py-4 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-60"
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.08em', background: 'linear-gradient(135deg,#3461f5,#7c3aed)', boxShadow: loading ? 'none' : 'var(--glow-blue)' }}>
          {loading ? <span className="flex items-center gap-2"><SpinnerIcon size={16} /> Connecting…</span> : 'CONNECT FREIGHTER'}
        </motion.button>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Don't have Freighter?{' '}
          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-400 transition-colors">Install it here →</a>
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FAUCET APP — root component
// ─────────────────────────────────────────────────────────────────────────────
export function FaucetApp() {
  const wallet = useWallet();
  const { data: stats, isLoading: statsLoading, error: statsError } = useFaucetStats(wallet.publicKey);
  const { data: history = [] } = useRequestHistory(wallet.publicKey);
  const { requestFunds, status, lastTxHash, error: txError } = useFaucetRequest(wallet.publicKey, wallet.signTransaction);

  useEffect(() => {
    if (status === 'success' && lastTxHash) {
      toast.success(`10 XLM sent! TX: ${lastTxHash.slice(0, 8)}…`, { duration: 5_000, icon: '🚀' });
    }
    if (status === 'error' && txError) {
      const msg = txError.includes('rate limited') ? '⏳ Rate limited — please wait.' : `Transaction failed: ${txError.slice(0, 60)}`;
      toast.error(msg, { duration: 5_000 });
    }
  }, [status, lastTxHash, txError]);

  return (
    <div className="flex flex-col gap-6">
      <Header />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex justify-end">
        <WalletButton wallet={wallet} />
      </motion.div>
      <AnimatePresence mode="wait">
        {!wallet.connected ? (
          <motion.div key="connect-prompt" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35 }}>
            <ConnectPrompt onConnect={wallet.connect} loading={wallet.loading} />
          </motion.div>
        ) : (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <FaucetCard stats={stats} statsLoading={statsLoading} txStatus={status} lastTxHash={lastTxHash} onRequest={requestFunds} publicKey={wallet.publicKey!} />
              <RequestHistory history={history} />
            </div>
            <div className="flex flex-col gap-6">
              <StatsPanel stats={stats} loading={statsLoading} error={statsError?.message} />
              <AnalyticsPanel history={history} stats={stats} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FaucetApp;
