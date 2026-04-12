import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api';

// ── Check if extension is installed ──────────────────────────────────────────
export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const { isConnected: connected } = await isConnected();
    return connected;
  } catch {
    return false; // Extension not present
  }
}

// ── Check if this site is already allowed ────────────────────────────────────
export async function checkFreighterAllowed(): Promise<boolean> {
  try {
    const { isAllowed: allowed } = await isAllowed();
    return allowed;
  } catch {
    return false;
  }
}

// ── Connect (prompts user if not yet allowed) ────────────────────────────────
export async function connectFreighter(): Promise<string> {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error('Freighter extension not found. Install it at freighter.app');
  }

  // requestAccess shows the permission popup if needed
  const { address, error } = await requestAccess();
  if (error) throw new Error(error);
  if (!address) throw new Error('No address returned from Freighter');

  return address;
}

// ── Get current address (only works if already allowed) ─────────────────────
export async function getWalletAddress(): Promise<string | null> {
  try {
    const { address, error } = await getAddress();
    if (error || !address) return null;
    return address;
  } catch {
    return null;
  }
}

// ── Get network ──────────────────────────────────────────────────────────────
export async function getWalletNetwork(): Promise<string> {
  const { network, error } = await getNetwork();
  if (error) throw new Error(error);
  return network; // 'TESTNET' | 'PUBLIC' | 'FUTURENET'
}

// ── Sign a transaction XDR ───────────────────────────────────────────────────
export async function signTx(
  xdr: string,
  networkPassphrase: string
): Promise<string> {
  const { signedTxXdr, error } = await signTransaction(xdr, {
    networkPassphrase,
  });
  if (error) throw new Error(error);
  return signedTxXdr;
}