import * as StellarSdk from '@stellar/stellar-sdk';
import type { ContractCallResult, FaucetStats } from '@/types';

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────
export const STELLAR_CONFIG = {
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
    'Test SDF Network ; September 2015',
  faucetContractId: process.env.NEXT_PUBLIC_FAUCET_CONTRACT_ID || '',
  nativeTokenId:
    process.env.NEXT_PUBLIC_NATIVE_TOKEN_ID ||
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYW',
  friendbotUrl: 'https://friendbot.stellar.org',
};

export const STROOPS_PER_XLM = 10_000_000n;

export function stroopsToXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const frac  = stroops % STROOPS_PER_XLM;
  return `${whole}.${frac.toString().padStart(7, '0').replace(/0+$/, '') || '0'}`;
}

export function xlmToStroops(xlm: string): bigint {
  const [w, f = ''] = xlm.split('.');
  const fracPadded = f.padEnd(7, '0').slice(0, 7);
  return BigInt(w) * STROOPS_PER_XLM + BigInt(fracPadded);
}

// ─────────────────────────────────────────────
//  RPC client (singleton)
// ─────────────────────────────────────────────
let _rpc: StellarSdk.SorobanRpc.Server | null = null;
export function getRpcServer(): StellarSdk.SorobanRpc.Server {
  if (!_rpc) {
    _rpc = new StellarSdk.SorobanRpc.Server(STELLAR_CONFIG.rpcUrl, {
      allowHttp: STELLAR_CONFIG.rpcUrl.startsWith('http://'),
    });
  }
  return _rpc;
}

// ─────────────────────────────────────────────
//  Contract client helpers
// ─────────────────────────────────────────────
export function getFaucetContract() {
  const contractId = STELLAR_CONFIG.faucetContractId;
  if (!contractId) throw new Error('FAUCET_CONTRACT_ID not set in env');
  return new StellarSdk.Contract(contractId);
}

// ─────────────────────────────────────────────
//  Read-only: Faucet stats for a user
// ─────────────────────────────────────────────
export async function fetchFaucetStats(userPublicKey: string): Promise<FaucetStats> {
  const rpc = getRpcServer();
  const contract = getFaucetContract();

  const userAddress = StellarSdk.Address.fromString(userPublicKey);
  const userScVal  = userAddress.toScVal();

  const calls = await Promise.allSettled([
    rpc.simulateTransaction(
      buildSimTx(contract.call('get_last_request', userScVal))
    ),
    rpc.simulateTransaction(
      buildSimTx(contract.call('get_request_count', userScVal))
    ),
    rpc.simulateTransaction(
      buildSimTx(contract.call('get_global_count'))
    ),
    rpc.simulateTransaction(
      buildSimTx(contract.call('get_cooldown_remaining', userScVal))
    ),
    rpc.simulateTransaction(
      buildSimTx(contract.call('get_faucet_amount'))
    ),
    fetchContractBalance(STELLAR_CONFIG.faucetContractId),
  ]);

  const parseU64 = (r: PromiseSettledResult<any>, def = 0n): bigint => {
    if (r.status !== 'fulfilled') return BigInt(def);
    const sim = r.value as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse;
    if (!sim.result) return BigInt(def);
    try {
      return StellarSdk.scValToNative(sim.result.retval) as bigint;
    } catch { return BigInt(def); }
  };

  const lastTs = parseU64(calls[0]);
  const reqCount = parseU64(calls[1]);
  const globalCount = parseU64(calls[2]);
  const cooldown = parseU64(calls[3]);
  const faucetAmt = parseU64(calls[4], BigInt(100_000_000));
  const balance = calls[5].status === 'fulfilled' ? (calls[5].value as bigint) : 0n;

  return {
    lastRequestTimestamp: lastTs > 0n ? Number(lastTs) : null,
    requestCount: Number(reqCount),
    globalCount: Number(globalCount),
    cooldownRemaining: Number(cooldown),
    faucetAmount: stroopsToXlm(faucetAmt),
    contractBalance: stroopsToXlm(balance),
  };
}

async function fetchContractBalance(contractId: string): Promise<bigint> {
  try {
    const rpc = getRpcServer();
    const account = await rpc.getAccount(contractId);
    // native XLM balance is in the account
    return xlmToStroops(account.balances?.[0]?.balance || '0');
  } catch {
    return 0n;
  }
}

// ─────────────────────────────────────────────
//  Write: Request funds
// ─────────────────────────────────────────────
export async function requestFaucetFunds(
  userPublicKey: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<ContractCallResult> {
  const rpc = getRpcServer();
  const contract = getFaucetContract();

  const userAddress = StellarSdk.Address.fromString(userPublicKey);
  const tokenAddress = StellarSdk.Address.fromString(STELLAR_CONFIG.nativeTokenId);

  const account = await rpc.getAccount(userPublicKey);

  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(account.accountId(), account.sequenceNumber()),
    {
      fee: '200',
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
    }
  )
    .addOperation(
      contract.call(
        'request_funds',
        userAddress.toScVal(),
        tokenAddress.toScVal()
      )
    )
    .setTimeout(30)
    .build();

  // Simulate first
  const simResult = await rpc.simulateTransaction(tx);
  if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const assembled = StellarSdk.SorobanRpc.assembleTransaction(
    tx,
    simResult
  ).build();

  // Sign with Freighter
  const signedXdr = await signTransaction(assembled.toXDR());
  const signedTx  = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    STELLAR_CONFIG.networkPassphrase
  );

  // Submit
  const sendResult = await rpc.sendTransaction(signedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${sendResult.errorResult?.toXDR()}`);
  }

  // Poll until confirmed
  const txHash = sendResult.hash;
  let pollResult = await rpc.getTransaction(txHash);
  let attempts = 0;

  while (
    pollResult.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
    attempts < 20
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    pollResult = await rpc.getTransaction(txHash);
    attempts++;
  }

  if (pollResult.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    let amount = 100_000_000n;
    try {
      const retVal = (pollResult as any).returnValue;
      if (retVal) amount = StellarSdk.scValToNative(retVal) as bigint;
    } catch { /* use default */ }

    return { txHash, amount, success: true };
  }

  throw new Error(`Transaction failed: ${pollResult.status}`);
}

// ─────────────────────────────────────────────
//  Friendbot — fund a new testnet account
// ─────────────────────────────────────────────
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const resp = await fetch(
    `${STELLAR_CONFIG.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
  );
  if (!resp.ok) throw new Error('Friendbot funding failed');
}

// ─────────────────────────────────────────────
//  Internal: build a minimal tx for simulation
// ─────────────────────────────────────────────
function buildSimTx(operation: StellarSdk.Operation): StellarSdk.Transaction {
  // Use a dummy account for simulation only
  const dummy = new StellarSdk.Account(
    'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    '1'
  );
  return new StellarSdk.TransactionBuilder(dummy, {
    fee: '100',
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();
}
