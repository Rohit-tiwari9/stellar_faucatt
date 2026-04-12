'use client';

import { useWallet } from '@/hooks/useWallet';

export function ConnectButton() {
  const { installed, connected, loading, error, shortAddress, connect, disconnect } = useWallet();

  // Still checking if Freighter is present
  if (installed === null) {
    return (
      <button disabled className="btn-wallet opacity-50">
        Checking wallet…
      </button>
    );
  }

  // Extension not found at all
  if (installed === false) {
    return (
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-wallet text-amber-400 border-amber-400/40"
      >
        Install Freighter →
      </a>
    );
  }

  // Connected
  if (connected) {
    return (
      <button onClick={disconnect} className="btn-wallet text-green-400 border-green-400/40">
        {shortAddress} · Disconnect
      </button>
    );
  }

  // Not connected
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={loading}
        className="btn-wallet"
      >
        {loading ? 'Connecting…' : 'Connect Freighter'}
      </button>
      {error && (
        <p className="text-xs text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
}