'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WalletState } from '@/types';

// Freighter API types (dynamic import to avoid SSR issues)
type FreighterApi = {
  isConnected: () => Promise<{ isConnected: boolean }>;
  isAllowed: () => Promise<{ isAllowed: boolean }>;
  requestAccess: () => Promise<{ address: string; error?: string }>;
  getPublicKey: () => Promise<{ publicKey: string; error?: string }>;
  getNetwork: () => Promise<{ network: string; networkPassphrase: string; error?: string }>;
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<{ signedTxXdr: string; error?: string }>;
};

const STORAGE_KEY = 'stellar_faucet_wallet';

function loadPersistedKey(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function persistKey(key: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    network: null,
    loading: false,
    error: null,
  });

  const freighterRef = useRef<FreighterApi | null>(null);

  // Lazy-load Freighter API (browser only)
  const getFreighter = useCallback(async (): Promise<FreighterApi> => {
    if (freighterRef.current) return freighterRef.current;
    const api = await import('@stellar/freighter-api') as unknown as FreighterApi;
    freighterRef.current = api;
    return api;
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    const savedKey = loadPersistedKey();
    if (!savedKey) return;

    (async () => {
      try {
        const api = await getFreighter();
        const { isConnected } = await api.isConnected();
        if (!isConnected) return;

        const { isAllowed } = await api.isAllowed();
        if (!isAllowed) return;

        const { publicKey, error } = await api.getPublicKey();
        if (error || !publicKey) return;

        const { network } = await api.getNetwork();

        setState({
          connected: true,
          publicKey,
          network: network || 'TESTNET',
          loading: false,
          error: null,
        });
      } catch { /* silent fail on auto-reconnect */ }
    })();
  }, [getFreighter]);

  // Connect wallet
  const connect = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const api = await getFreighter();

      const { isConnected } = await api.isConnected();
      if (!isConnected) {
        throw new Error('Freighter extension not found. Please install it from freighter.app');
      }

      const { address, error } = await api.requestAccess();
      if (error) throw new Error(error);
      if (!address) throw new Error('No address returned');

      const { network } = await api.getNetwork();

      persistKey(address);
      setState({
        connected: true,
        publicKey: address,
        network: network || 'TESTNET',
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Failed to connect wallet',
      }));
    }
  }, [getFreighter]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    persistKey(null);
    setState({
      connected: false,
      publicKey: null,
      network: null,
      loading: false,
      error: null,
    });
  }, []);

  // Sign a transaction XDR via Freighter
  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      const api = await getFreighter();
      const { signedTxXdr, error } = await api.signTransaction(xdr, {
        networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
      });
      if (error) throw new Error(error);
      return signedTxXdr;
    },
    [getFreighter]
  );

  // Format address for display
  const shortAddress = state.publicKey
    ? `${state.publicKey.slice(0, 6)}…${state.publicKey.slice(-4)}`
    : null;

  return {
    ...state,
    shortAddress,
    connect,
    disconnect,
    signTransaction,
  };
}
