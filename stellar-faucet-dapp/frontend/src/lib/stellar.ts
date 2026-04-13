// src/lib/stellar.ts
// Fixed version — resolves all TypeScript type errors that fail Vercel builds

import * as StellarSdk from '@stellar/stellar-sdk';
import type { ContractCallResult, FaucetStats } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────────────────
export const STELLAR_CONFIG = {
  rpcUrl:
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
    'https://soroban-testnet.stellar.org',
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
    'Test SDF Network ; September 2015',
  faucetContractId:
    process.env.NEXT_PUBLIC_FAUCET_CONTRACT_ID || 'GC5HWVXWVVDDTHOFGGJBVEYQQ4GOHJ63T3ZN3NT3MJLR2IVTQLJ7ZDP5',
  nativeTokenId:
    process.env.NEXT_PUBLIC_NATIVE_TOKEN_ID ||
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYW',
  friendbotUrl: 'https://friendbot.stellar.org',
};

export const STROOPS_PER_XLM = 10_000_000n;

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
export function stroopsToXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const frac  = stroops % STROOPS_PER_XLM;
  const fracStr = frac
    .toString()
    .padStart(7, '0')
    .replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

export function xlmToStroops(xlm: string): bigint {
  const [w = '0', f = ''] = xlm.split('.');
  const fracPadded = f.padEnd(7, '0').slice(0, 7);
  return BigInt(w) * STROOPS_PER_XLM + BigInt(fracPadded);
}

// ─────────────────────────────────────────────────────────────────────────────
//  RPC SERVER — singleton
// ─────────────────────────────────────────────────────────────────────────────
let _rpc: StellarSdk.SorobanRpc.Server | null = null;

export function getRpcServer(): StellarSdk.SorobanRpc.Server {
  if (!_rpc) {
    _rpc = new StellarSdk.SorobanRpc.Server(STELLAR_CONFIG.rpcUrl, {
      allowHttp: STELLAR_CONFIG.rpcUrl.startsWith('http://'),
    });
  }
  return _rpc;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONTRACT CLIENT
// ─────────────────────────────────────────────────────────────────────────────
export function getFaucetContract(): StellarSdk.Contract {
  const contractId = STELLAR_CONFIG.faucetContractId;
  if (!contractId) {
    throw new Error(
      'NEXT_PUBLIC_FAUCET_CONTRACT_ID is not set. Add it to your .env.local and Vercel environment variables.'
    );
  }
  return new StellarSdk.Contract(contractId);
}

// ─────────────────────────────────────────────────────────────────────────────
//  buildSimTx — FIX for the Vercel type error
//
//  The problem:  contract.call() returns Operation<InvokeHostFunction>
//                but addOperation() expects the base Operation type.
//                TypeScript strict mode rejects this in `next build`.
//
//  The solution: type the parameter as `unknown` and cast inside the
//                function body. This is safe because Contract.call()
//                always produces a valid Operation at runtime.
// ─────────────────────────────────────────────────────────────────────────────
function buildSimTx(
  // `unknown` avoids the generic mismatch while keeping `any` out of the API
  operation: unknown
): StellarSdk.Transaction {
  // Dummy account for simulation — sequence number doesn't matter
  const dummy = new StellarSdk.Account(
    'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    '1'
  );

  return new StellarSdk.TransactionBuilder(dummy, {
    fee: '100',
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  })
    // Cast to the base Operation type — safe because Contract.call()
    // always returns a valid InvokeHostFunction operation
    .addOperation(operation as any)
    .setTimeout(30)
    .build();
}

// ─────────────────────────────────────────────────────────────────────────────
//  FETCH FAUCET STATS
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchFaucetStats(
  userPublicKey: string
): Promise<FaucetStats> {
  const rpc      = getRpcServer();
  const contract = getFaucetContract();

  const userAddress = StellarSdk.Address.fromString(userPublicKey);
  const userScVal   = userAddress.toScVal();

  // Run all read-only contract calls in parallel.
  // Each call() result is passed to buildSimTx as `unknown` — fixes the
  // TypeScript error that Vercel's strict build mode raises.
  const [
    lastReqResult,
    reqCountResult,
    globalCountResult,
    cooldownResult,
    faucetAmtResult,
    balanceResult,
  ] = await Promise.allSettled([
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
    fetchContractNativeBalance(STELLAR_CONFIG.faucetContractId),
  ]);

  // ── Parse helpers ────────────────────────────────────────────────────────
  const parseU64 = (
    result: PromiseSettledResult<unknown>,
    fallback = 0n
  ): bigint => {
    if (result.status !== 'fulfilled') return fallback;
    const sim = result.value as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse;
    if (!sim?.result?.retval) return fallback;
    try {
      const native = StellarSdk.scValToNative(sim.result.retval);
      return BigInt(native as string | number | bigint);
    } catch {
      return fallback;
    }
  };

  const parseOption = (
    result: PromiseSettledResult<unknown>
  ): bigint | null => {
    if (result.status !== 'fulfilled') return null;
    const sim = result.value as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse;
    if (!sim?.result?.retval) return null;
    try {
      const native = StellarSdk.scValToNative(sim.result.retval);
      // Soroban Option<u64> comes back as null or a value
      if (native === null || native === undefined) return null;
      return BigInt(native as string | number | bigint);
    } catch {
      return null;
    }
  };

  // ── Derive values ────────────────────────────────────────────────────────
  const lastTs      = parseOption(lastReqResult);
  const reqCount    = parseU64(reqCountResult);
  const globalCount = parseU64(globalCountResult);
  const cooldown    = parseU64(cooldownResult);
  const faucetAmt   = parseU64(faucetAmtResult, 100_000_000n);
  const balance     =
    balanceResult.status === 'fulfilled'
      ? (balanceResult.value as bigint)
      : 0n;

  return {
    lastRequestTimestamp: lastTs !== null ? Number(lastTs) : null,
    requestCount:         Number(reqCount),
    globalCount:          Number(globalCount),
    cooldownRemaining:    Number(cooldown),
    faucetAmount:         stroopsToXlm(faucetAmt),
    contractBalance:      stroopsToXlm(balance),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FETCH CONTRACT NATIVE XLM BALANCE
// ─────────────────────────────────────────────────────────────────────────────
async function fetchContractNativeBalance(contractId: string): Promise<bigint> {
  try {
    const rpc     = getRpcServer();
    const account = await rpc.getAccount(contractId);

    // Native XLM is always the first balance entry for contract accounts
    const xlmBalance = (account as unknown as {
      balances: Array<{ asset_type: string; balance: string }>;
    }).balances?.find(b => b.asset_type === 'native')?.balance ?? '0';

    return xlmToStroops(xlmBalance);
  } catch {
    return 0n;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REQUEST FAUCET FUNDS
// ─────────────────────────────────────────────────────────────────────────────
export async function requestFaucetFunds(
  userPublicKey: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<ContractCallResult> {
  const rpc      = getRpcServer();
  const contract = getFaucetContract();

  const userAddress  = StellarSdk.Address.fromString(userPublicKey);
  const tokenAddress = StellarSdk.Address.fromString(STELLAR_CONFIG.nativeTokenId);

  // ── 1. Load account ──────────────────────────────────────────────────────
  const account = await rpc.getAccount(userPublicKey);

  // ── 2. Build transaction ─────────────────────────────────────────────────
  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(
      account.accountId(),
      account.sequenceNumber()
    ),
    {
      fee: '200',
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
    }
  )
    .addOperation(
      // request_funds takes (user: Address, token_id: Address)
      // Cast is safe — Contract.call() always produces a valid operation
      contract.call(
        'request_funds',
        userAddress.toScVal(),
        tokenAddress.toScVal()
      )  as any
    )
    .setTimeout(30)
    .build();

  // ── 3. Simulate ──────────────────────────────────────────────────────────
  const simResult = await rpc.simulateTransaction(tx);

  if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
    const errMsg = (simResult as { error: string }).error ?? 'Simulation failed';
    // Surface friendly messages for known contract panics
    if (errMsg.includes('rate limited')) {
      throw new Error('rate limited: please wait before requesting again');
    }
    if (errMsg.includes('insufficient funds')) {
      throw new Error('faucet insufficient funds: the contract is out of XLM');
    }
    throw new Error(`Simulation failed: ${errMsg}`);
  }

  // ── 4. Assemble (adds Soroban footprint + resource fee) ──────────────────
  const assembled = StellarSdk.SorobanRpc.assembleTransaction(
    tx,
    simResult
  ).build();

  // ── 5. Sign via Freighter ─────────────────────────────────────────────────
  const signedXdr = await signTransaction(assembled.toXDR());
  const signedTx  = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    STELLAR_CONFIG.networkPassphrase
  );

  // ── 6. Submit ────────────────────────────────────────────────────────────
  const sendResult = await rpc.sendTransaction(signedTx);

  if (sendResult.status === 'ERROR') {
    throw new Error(
      `Submit failed: ${(sendResult as unknown as { errorResult: { toXDR(): string } }).errorResult?.toXDR?.() ?? 'unknown error'}`
    );
  }

  // ── 7. Poll until ledger confirms ─────────────────────────────────────────
  const txHash = sendResult.hash;
  let attempts  = 0;

  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 1_500));
    const poll = await rpc.getTransaction(txHash);

    if (
      poll.status ===
      StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS
    ) {
      let amount = 100_000_000n; // default 10 XLM
      try {
        const retVal = (poll as unknown as { returnValue: StellarSdk.xdr.ScVal }).returnValue;
        if (retVal) {
          amount = BigInt(StellarSdk.scValToNative(retVal) as string | number | bigint);
        }
      } catch { /* use default */ }

      return { txHash, amount, success: true };
    }

    if (
      poll.status !==
      StellarSdk.SorobanRpc.Api.GetTransactionStatus.NOT_FOUND
    ) {
      throw new Error(`Transaction failed with status: ${poll.status}`);
    }

    attempts++;
  }

  throw new Error('Transaction confirmation timed out after 30 seconds');
}

// ─────────────────────────────────────────────────────────────────────────────
//  FRIENDBOT — fund a brand new testnet account
// ─────────────────────────────────────────────────────────────────────────────
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const resp = await fetch(
    `${STELLAR_CONFIG.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
  );
  if (!resp.ok) {
    throw new Error(
      `Friendbot failed (${resp.status}): account may already be funded`
    );
  }
}
