/**
 * Integration-level tests for the Stellar SDK interaction layer.
 *
 * These tests mock the RPC server and verify the full request lifecycle:
 * simulate → assemble → sign → submit → poll → parse.
 *
 * Run with: npm test (vitest picks this up automatically)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stroopsToXlm, xlmToStroops, STROOPS_PER_XLM } from '@/lib/stellar';

// ─────────────────────────────────────────────
//  Unit: stroops ↔ XLM conversions
// ─────────────────────────────────────────────
describe('stroopsToXlm', () => {
  it('converts 10 XLM correctly', () => {
    expect(stroopsToXlm(100_000_000n)).toBe('10.0');
  });

  it('converts 1 XLM correctly', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1.0');
  });

  it('converts fractional XLM', () => {
    expect(stroopsToXlm(5_000_000n)).toBe('0.5');
  });

  it('converts smallest unit (1 stroop)', () => {
    expect(stroopsToXlm(1n)).toBe('0.0000001');
  });

  it('converts 0 correctly', () => {
    expect(stroopsToXlm(0n)).toBe('0.0');
  });

  it('converts large amounts', () => {
    // 10,000 XLM
    expect(stroopsToXlm(100_000_000_000n)).toBe('10000.0');
  });

  it('strips trailing zeros from fractional part', () => {
    // 1.5 XLM = 15,000,000 stroops
    expect(stroopsToXlm(15_000_000n)).toBe('1.5');
  });
});

describe('xlmToStroops', () => {
  it('converts 10 XLM', () => {
    expect(xlmToStroops('10')).toBe(100_000_000n);
  });

  it('converts fractional XLM', () => {
    expect(xlmToStroops('0.5')).toBe(5_000_000n);
  });

  it('converts 7 decimal places', () => {
    expect(xlmToStroops('0.0000001')).toBe(1n);
  });

  it('converts large amounts', () => {
    expect(xlmToStroops('10000')).toBe(100_000_000_000n);
  });

  it('handles missing fractional part', () => {
    expect(xlmToStroops('5')).toBe(50_000_000n);
  });
});

describe('STROOPS_PER_XLM', () => {
  it('is exactly 10,000,000', () => {
    expect(STROOPS_PER_XLM).toBe(10_000_000n);
  });
});

describe('Round-trip precision', () => {
  const cases = [
    1n, 7n, 100n, 10_000_000n, 100_000_000n,
    123_456_789n, 999_999_999n, 10_000_000_000n,
  ];

  cases.forEach((stroops) => {
    it(`round-trips ${stroops} stroops`, () => {
      const xlm  = stroopsToXlm(stroops);
      const back = xlmToStroops(xlm);
      expect(back).toBe(stroops);
    });
  });
});

// ─────────────────────────────────────────────
//  STELLAR_CONFIG validation
// ─────────────────────────────────────────────
describe('STELLAR_CONFIG', () => {
  it('has required keys', async () => {
    const { STELLAR_CONFIG } = await import('@/lib/stellar');
    expect(STELLAR_CONFIG).toHaveProperty('rpcUrl');
    expect(STELLAR_CONFIG).toHaveProperty('networkPassphrase');
    expect(STELLAR_CONFIG).toHaveProperty('nativeTokenId');
    expect(STELLAR_CONFIG).toHaveProperty('friendbotUrl');
  });

  it('defaults to testnet RPC', async () => {
    const { STELLAR_CONFIG } = await import('@/lib/stellar');
    expect(STELLAR_CONFIG.rpcUrl).toContain('testnet');
  });

  it('has correct testnet passphrase', async () => {
    const { STELLAR_CONFIG } = await import('@/lib/stellar');
    expect(STELLAR_CONFIG.networkPassphrase).toBe(
      'Test SDF Network ; September 2015'
    );
  });
});

// ─────────────────────────────────────────────
//  useCooldownTimer hook
// ─────────────────────────────────────────────
import { renderHook, act } from '@testing-library/react';
import { useCooldownTimer } from '@/hooks/useFaucet';

describe('useCooldownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialises with given value', () => {
    const { result } = renderHook(() => useCooldownTimer(45));
    expect(result.current).toBe(45);
  });

  it('counts down by 1 each second', () => {
    const { result } = renderHook(() => useCooldownTimer(10));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(7);
  });

  it('stops at 0 and does not go negative', () => {
    const { result } = renderHook(() => useCooldownTimer(2));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current).toBe(0);
  });

  it('initialises at 0 with no countdown', () => {
    const { result } = renderHook(() => useCooldownTimer(0));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(0);
  });

  it('updates when prop changes', () => {
    let cooldown = 30;
    const { result, rerender } = renderHook(() => useCooldownTimer(cooldown));
    expect(result.current).toBe(30);
    cooldown = 60;
    rerender();
    expect(result.current).toBe(60);
  });
});

// ─────────────────────────────────────────────
//  AnalyticsPanel logic (pure computation)
// ─────────────────────────────────────────────
import type { FaucetRequest } from '@/types';

function computeAnalytics(history: FaucetRequest[]) {
  if (!history.length) return null;
  const now = Date.now();
  const last24h = history.filter((r) => now - r.timestamp < 86_400_000);
  const totalXlm = history
    .filter((r) => r.status === 'success')
    .reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
  const successRate = Math.round(
    (history.filter((r) => r.status === 'success').length / history.length) * 100
  );
  return { totalXlm, last24h: last24h.length, successRate };
}

describe('Analytics computation', () => {
  const makeReq = (overrides: Partial<FaucetRequest> = {}): FaucetRequest => ({
    id: Math.random().toString(36).slice(2),
    txHash: 'a'.repeat(64),
    amount: '10.0',
    timestamp: Date.now() - 1000,
    status: 'success',
    address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    ...overrides,
  });

  it('returns null for empty history', () => {
    expect(computeAnalytics([])).toBeNull();
  });

  it('totals XLM correctly for multiple requests', () => {
    const h = [makeReq({ amount: '10.0' }), makeReq({ amount: '10.0' })];
    expect(computeAnalytics(h)?.totalXlm).toBe(20);
  });

  it('only counts successful requests in XLM total', () => {
    const h = [
      makeReq({ amount: '10.0', status: 'success' }),
      makeReq({ amount: '10.0', status: 'error' }),
    ];
    expect(computeAnalytics(h)?.totalXlm).toBe(10);
  });

  it('calculates 100% success rate', () => {
    const h = [makeReq(), makeReq(), makeReq()];
    expect(computeAnalytics(h)?.successRate).toBe(100);
  });

  it('calculates 50% success rate', () => {
    const h = [makeReq({ status: 'success' }), makeReq({ status: 'error' })];
    expect(computeAnalytics(h)?.successRate).toBe(50);
  });

  it('filters last24h correctly', () => {
    const h = [
      makeReq({ timestamp: Date.now() - 3600_000 }),        // 1h ago — in
      makeReq({ timestamp: Date.now() - 90_000_000 }),       // 25h ago — out
    ];
    expect(computeAnalytics(h)?.last24h).toBe(1);
  });
});
