'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  checkFreighterInstalled,
  connectFreighter,
  getWalletAddress,
  getWalletNetwork,
  signTx,
} from '@/lib/freighter';

const STORAGE_KEY = 'faucet_wallet_address';

export function useWallet() {
  const [publicKey, setPublicKey]   = useState<string | null>(null);
  const [network, setNetwork]       = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [installed, setInstalled]   = useState<boolean | null>(null); // null = checking

  // ── On mount: check if Freighter is installed + auto-reconnect ─────────────
  useEffect(() => {
    (async () => {
      // Must be client-side — Freighter API is browser-only
      if (typeof window === 'undefined') return;

      const isInstalled = await checkFreighterInstalled();
      setInstalled(isInstalled);

      if (!isInstalled) return;

      // Try to restore previous session (only works if still allowed)
      const savedKey = localStorage.getItem(STORAGE_KEY);
      if (!savedKey) return;

      const currentAddress = await getWalletAddress();
      if (currentAddress && currentAddress === savedKey) {
        const net = await getWalletNetwork();
        setPublicKey(currentAddress);
        setNetwork(net);
      } else {
        // Session expired or address changed — clear storage
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const address = await connectFreighter();
      const net = await getWalletNetwork();

      localStorage.setItem(STORAGE_KEY, address);
      setPublicKey(address);
      setNetwork(net);
    } catch (err: any) {
      setError(err.message ?? 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPublicKey(null);
    setNetwork(null);
    setError(null);
  }, []);

  // ── Sign transaction ───────────────────────────────────────────────────────
  const signTransaction = useCallback(
    async (xdr: string, networkPassphrase: string): Promise<string> => {
      return signTx(xdr, networkPassphrase);
    },
    []
  );

  return {
    publicKey,
    network,
    loading,
    error,
    installed,              // null = still checking, false = not installed
    connected: !!publicKey,
    shortAddress: publicKey
      ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`
      : null,
    connect,
    disconnect,
    signTransaction,
  };
}