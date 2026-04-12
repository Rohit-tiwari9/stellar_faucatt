import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─────────────────────────────────────────────
//  Test helpers
// ─────────────────────────────────────────────
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = createTestQueryClient();
  return {
    ...render(
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    ),
    queryClient: qc,
  };
}

// ─────────────────────────────────────────────
//  Mocked WalletButton (isolated)
// ─────────────────────────────────────────────
import dynamic from 'next/dynamic';

const WalletButton = dynamic(
  () => import('../components/WalletButton').then(m => m.WalletButton),
  { ssr: false }
);

const disconnectedWallet = {
  connected: false,
  publicKey: null,
  network: null,
  loading: false,
  error: null,
  shortAddress: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
};

const connectedWallet = {
  connected: true,
  publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  network: 'TESTNET',
  loading: false,
  error: null,
  shortAddress: 'GAAZI4…CCWN',
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
};

// ─────────────────────────────────────────────
//  Test 4: Wallet Connect button renders and triggers connect
// ─────────────────────────────────────────────
describe('WalletButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders connect button when wallet is disconnected', () => {
    render(<WalletButton wallet={disconnectedWallet} />);
    const btn = screen.getByTestId('connect-wallet-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/CONNECT WALLET/i);
  });

  it('calls connect() when button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletButton wallet={disconnectedWallet} />);
    await user.click(screen.getByTestId('connect-wallet-btn'));
    expect(disconnectedWallet.connect).toHaveBeenCalledTimes(1);
  });

  it('shows connected address when wallet is connected', () => {
    render(<WalletButton wallet={connectedWallet} />);
    const btn = screen.getByTestId('wallet-connected-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('GAAZI4');
  });

  it('is disabled during loading state', () => {
    render(<WalletButton wallet={{ ...disconnectedWallet, loading: true }} />);
    expect(screen.getByTestId('connect-wallet-btn')).toBeDisabled();
  });

  it('shows connecting text during loading', () => {
    render(<WalletButton wallet={{ ...disconnectedWallet, loading: true }} />);
    expect(screen.getByTestId('connect-wallet-btn')).toHaveTextContent(/Connecting/i);
  });

  it('shows disconnect option in dropdown', async () => {
    const user = userEvent.setup();
    render(<WalletButton wallet={connectedWallet} />);
    await user.click(screen.getByTestId('wallet-connected-btn'));
    expect(await screen.findByText(/Disconnect/i)).toBeInTheDocument();
  });

  it('calls disconnect() from dropdown', async () => {
    const user = userEvent.setup();
    render(<WalletButton wallet={connectedWallet} />);
    await user.click(screen.getByTestId('wallet-connected-btn'));
    await user.click(await screen.findByText(/Disconnect/i));
    expect(connectedWallet.disconnect).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────
//  Test 5: FaucetCard - button triggers request + loading state
// ─────────────────────────────────────────────
import { FaucetCard } from '@/components/FaucetCard';

const mockStats = {
  lastRequestTimestamp: null,
  requestCount: 0,
  globalCount: 42,
  cooldownRemaining: 0,
  faucetAmount: '10.0',
  contractBalance: '5000.0',
};

describe('FaucetCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the request button', () => {
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="idle"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByTestId('request-faucet-btn')).toBeInTheDocument();
  });

  it('calls onRequest when button is clicked', async () => {
    const onRequest = vi.fn();
    const user = userEvent.setup();
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="idle"
        lastTxHash={null}
        onRequest={onRequest}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    await user.click(screen.getByTestId('request-faucet-btn'));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  // Test 6: Loading state appears
  it('shows "SIGN IN FREIGHTER" text when status is signing', () => {
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="signing"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByTestId('request-faucet-btn')).toHaveTextContent(/SIGN IN FREIGHTER/i);
  });

  it('shows SUBMITTING text during submitting status', () => {
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="submitting"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByTestId('request-faucet-btn')).toHaveTextContent(/SUBMITTING/i);
  });

  it('shows CONFIRMING text during pending status', () => {
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="pending"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByTestId('request-faucet-btn')).toHaveTextContent(/CONFIRMING/i);
  });

  it('disables button when status is pending', () => {
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="pending"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByTestId('request-faucet-btn')).toBeDisabled();
  });

  it('disables button during cooldown', () => {
    render(
      <FaucetCard
        stats={{ ...mockStats, cooldownRemaining: 45 }}
        statsLoading={false}
        txStatus="idle"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    const btn = screen.getByTestId('request-faucet-btn');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/COOLDOWN/i);
  });

  it('shows success message on successful transaction', () => {
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="success"
        lastTxHash="abc123def456abc123def456abc123def456abc123def456abc123def456ab12"
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByTestId('request-faucet-btn')).toHaveTextContent(/SUCCESS/i);
  });

  it('shows faucet amount from stats', () => {
    render(
      <FaucetCard
        stats={{ ...mockStats, faucetAmount: '10.0' }}
        statsLoading={false}
        txStatus="idle"
        lastTxHash={null}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByText(/10\.0 XLM/i)).toBeInTheDocument();
  });

  it('displays tx hash after success', () => {
    const hash = 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12';
    render(
      <FaucetCard
        stats={mockStats}
        statsLoading={false}
        txStatus="success"
        lastTxHash={hash}
        onRequest={vi.fn()}
        publicKey="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
      />
    );
    expect(screen.getByText(/TRANSACTION HASH/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────
//  Utility tests
// ─────────────────────────────────────────────
import { stroopsToXlm, xlmToStroops } from '@/lib/stellar';

describe('Stellar utility functions', () => {
  it('converts stroops to XLM correctly', () => {
    expect(stroopsToXlm(100_000_000n)).toBe('10.0');
    expect(stroopsToXlm(10_000_000n)).toBe('1.0');
    expect(stroopsToXlm(1n)).toBe('0.0000001');
  });

  it('converts XLM to stroops correctly', () => {
    expect(xlmToStroops('10')).toBe(100_000_000n);
    expect(xlmToStroops('1')).toBe(10_000_000n);
    expect(xlmToStroops('0.5')).toBe(5_000_000n);
  });

  it('round-trips correctly', () => {
    const original = 123_456_789n;
    const xlm = stroopsToXlm(original);
    const back = xlmToStroops(xlm);
    expect(back).toBe(original);
  });
});

// ─────────────────────────────────────────────
//  RequestHistory tests
// ─────────────────────────────────────────────
import { RequestHistory } from '@/components/RequestHistory';
import type { FaucetRequest } from '@/types';

describe('RequestHistory', () => {
  it('shows empty state when no history', () => {
    render(<RequestHistory history={[]} />);
    expect(screen.getByText(/No requests yet/i)).toBeInTheDocument();
  });

  it('renders history items', () => {
    const history: FaucetRequest[] = [
      {
        id: 'tx1',
        txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12',
        amount: '10.0',
        timestamp: Date.now() - 5000,
        status: 'success',
        address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      },
    ];
    render(<RequestHistory history={history} />);
    expect(screen.getByText('+10.0 XLM')).toBeInTheDocument();
  });

  it('shows correct count badge', () => {
    const history: FaucetRequest[] = Array.from({ length: 3 }, (_, i) => ({
      id: `tx${i}`,
      txHash: `hash${i}`.padEnd(64, '0'),
      amount: '10.0',
      timestamp: Date.now() - i * 70000,
      status: 'success' as const,
      address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    }));
    render(<RequestHistory history={history} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
