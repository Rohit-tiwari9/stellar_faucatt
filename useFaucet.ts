'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { fetchFaucetStats, requestFaucetFunds, stroopsToXlm } from '@/lib/stellar';
import type { FaucetRequest, FaucetStats, TxStatus } from '@/types';

// ─────────────────────────────────────────────
//  Keys
// ─────────────────────────────────────────────
export const queryKeys = {
  faucetStats: (addr: string) => ['faucetStats', addr] as const,
  requestHistory: (addr: string) => ['requestHistory', addr] as const,
};

// ─────────────────────────────────────────────
//  Faucet stats (cached, auto-refetch)
// ─────────────────────────────────────────────
export function useFaucetStats(publicKey: string | null) {
  return useQuery<FaucetStats, Error>({
    queryKey: queryKeys.faucetStats(publicKey ?? ''),
    queryFn: () => {
      if (!publicKey) throw new Error('No public key');
      return fetchFaucetStats(publicKey);
    },
    enabled: !!publicKey,
    refetchInterval: 5000,       // poll every 5s
    staleTime: 3000,
    retry: 2,
  });
}

// ─────────────────────────────────────────────
//  Local request history (localStorage-backed)
// ─────────────────────────────────────────────
const HISTORY_KEY = (addr: string) => `faucet_history_${addr}`;

function loadHistory(addr: string): FaucetRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY(addr)) || '[]');
  } catch { return []; }
}

function saveHistory(addr: string, history: FaucetRequest[]) {
  if (typeof window === 'undefined') return;
  try {
    // Keep last 50 only
    localStorage.setItem(HISTORY_KEY(addr), JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore */ }
}

export function useRequestHistory(publicKey: string | null) {
  return useQuery<FaucetRequest[]>({
    queryKey: queryKeys.requestHistory(publicKey ?? ''),
    queryFn: () => {
      if (!publicKey) return [];
      return loadHistory(publicKey);
    },
    enabled: !!publicKey,
    staleTime: Infinity, // local data, never stale
  });
}

// ─────────────────────────────────────────────
//  Faucet request mutation
// ─────────────────────────────────────────────
export function useFaucetRequest(
  publicKey: string | null,
  signTransaction: (xdr: string) => Promise<string>
) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error('Wallet not connected');
      setStatus('signing');
      setError(null);
      const result = await requestFaucetFunds(publicKey, async (xdr) => {
        setStatus('submitting');
        return signTransaction(xdr);
      });
      setStatus('pending');
      return result;
    },
    onSuccess: (result) => {
      setStatus('success');
      setLastTxHash(result.txHash);

      // Add to local history
      if (publicKey) {
        const prev = loadHistory(publicKey);
        const entry: FaucetRequest = {
          id: result.txHash,
          txHash: result.txHash,
          amount: stroopsToXlm(result.amount),
          timestamp: Date.now(),
          status: 'success',
          address: publicKey,
        };
        const updated = [entry, ...prev];
        saveHistory(publicKey, updated);
        queryClient.setQueryData(queryKeys.requestHistory(publicKey), updated);
      }

      // Invalidate stats to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.faucetStats(publicKey ?? '') });

      // Reset to idle after 5s
      setTimeout(() => setStatus('idle'), 5000);
    },
    onError: (err: Error) => {
      setStatus('error');
      setError(err.message || 'Transaction failed');
      setTimeout(() => setStatus('idle'), 4000);
    },
  });

  const requestFunds = () => mutation.mutate();

  return {
    requestFunds,
    status,
    lastTxHash,
    error,
    isPending: status !== 'idle' && status !== 'success' && status !== 'error',
  };
}

// ─────────────────────────────────────────────
//  Live countdown timer hook
// ─────────────────────────────────────────────
export function useCooldownTimer(cooldownRemaining: number) {
  const [remaining, setRemaining] = useState(cooldownRemaining);

  useEffect(() => {
    setRemaining(cooldownRemaining);
  }, [cooldownRemaining]);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining]);

  return remaining;
}
