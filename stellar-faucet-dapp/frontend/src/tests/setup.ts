import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

// Mock Freighter API
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: true }),
  isAllowed: vi.fn().mockResolvedValue({ isAllowed: true }),
  requestAccess: vi.fn().mockResolvedValue({
    address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  }),
  getPublicKey: vi.fn().mockResolvedValue({
    publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  }),
  getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET', networkPassphrase: 'Test SDF Network ; September 2015' }),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'mock_signed_xdr' }),
}));

// Mock Stellar SDK
vi.mock('@stellar/stellar-sdk', () => ({
  SorobanRpc: {
    Server: vi.fn().mockImplementation(() => ({
      getAccount: vi.fn().mockResolvedValue({
        accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
        sequenceNumber: () => '1',
        balances: [{ balance: '10000.0000000' }],
      }),
      simulateTransaction: vi.fn().mockResolvedValue({
        result: { retval: { type: 'u64', value: BigInt(0) } },
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        status: 'PENDING',
        hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12',
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        returnValue: { type: 'i128', value: BigInt(100_000_000) },
      }),
    })),
    Api: {
      GetTransactionStatus: { NOT_FOUND: 'NOT_FOUND', SUCCESS: 'SUCCESS' },
      isSimulationError: vi.fn().mockReturnValue(false),
    },
    assembleTransaction: vi.fn().mockReturnValue({ build: vi.fn().mockReturnValue({ toXDR: () => 'mock_xdr' }) }),
  },
  TransactionBuilder: vi.fn().mockImplementation(() => ({
    addOperation: vi.fn().mockReturnThis(),
    setTimeout: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue({ toXDR: () => 'mock_xdr' }),
    fromXDR: vi.fn(),
  })),
  Account: vi.fn(),
  Contract: vi.fn().mockImplementation(() => ({
    call: vi.fn().mockReturnValue({}),
  })),
  Address: {
    fromString: vi.fn().mockReturnValue({ toScVal: vi.fn() }),
  },
  scValToNative: vi.fn().mockReturnValue(BigInt(0)),
}));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('ReactDOM.render')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
