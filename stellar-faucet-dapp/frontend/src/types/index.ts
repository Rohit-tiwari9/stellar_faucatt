// ─────────────────────────────────────────────
//  Wallet
// ─────────────────────────────────────────────
export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  network: string | null;
  loading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────
//  Faucet
// ─────────────────────────────────────────────
export type TxStatus =
  | 'idle'
  | 'signing'
  | 'submitting'
  | 'pending'
  | 'success'
  | 'error';

export interface FaucetRequest {
  id: string;
  txHash: string;
  amount: string;     // in XLM
  timestamp: number;  // unix ms
  status: 'success' | 'error';
  address: string;
}

export interface FaucetStats {
  lastRequestTimestamp: number | null;  // unix seconds
  requestCount: number;
  globalCount: number;
  cooldownRemaining: number;            // seconds
  faucetAmount: string;                 // XLM
  contractBalance: string;             // XLM
}

// ─────────────────────────────────────────────
//  Contract
// ─────────────────────────────────────────────
export interface ContractCallResult {
  txHash: string;
  amount: bigint;
  success: boolean;
}

// ─────────────────────────────────────────────
//  Analytics
// ─────────────────────────────────────────────
export interface AnalyticsData {
  totalRequests: number;
  uniqueUsers: number;
  totalXLMDispensed: number;
  last24hRequests: number;
  requestsByHour: { hour: string; count: number }[];
}
