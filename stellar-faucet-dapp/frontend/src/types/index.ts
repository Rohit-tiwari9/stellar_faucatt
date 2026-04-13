// src/types/index.ts

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET
// ─────────────────────────────────────────────────────────────────────────────
export interface WalletState {
  connected:  boolean;
  publicKey:  string | null;
  network:    string | null;
  loading:    boolean;
  error:      string | null;
  installed:  boolean | null; // null = still detecting
}

// ─────────────────────────────────────────────────────────────────────────────
//  FAUCET
// ─────────────────────────────────────────────────────────────────────────────
export type TxStatus =
  | 'idle'
  | 'signing'
  | 'submitting'
  | 'pending'
  | 'success'
  | 'error';

export interface FaucetRequest {
  id:        string;
  txHash:    string;
  amount:    string;      // XLM string e.g. "10.0"
  timestamp: number;      // unix milliseconds
  status:    'success' | 'error';
  address:   string;
}

export interface FaucetStats {
  lastRequestTimestamp: number | null;  // unix seconds from contract
  requestCount:         number;         // per-wallet count
  globalCount:          number;         // total across all wallets
  cooldownRemaining:    number;         // seconds until next request allowed
  faucetAmount:         string;         // XLM per request e.g. "10.0"
  contractBalance:      string;         // current faucet XLM balance
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
export interface ContractCallResult {
  txHash:  string;
  amount:  bigint;   // in stroops
  success: boolean;
}
