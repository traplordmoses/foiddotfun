/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import {
  requestWalletCreation,
  requestWalletUnlock,
  resolveWalletRequest,
} from '@/lib/connectors/onboardingBridge';

describe('onboarding bridge', () => {
  it('requestWalletCreation dispatches event and resolves on callback', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('foid-wallet:request-create', eventSpy);

    const promise = requestWalletCreation();

    // Event should have been dispatched
    expect(eventSpy).toHaveBeenCalledOnce();

    // Simulate modal resolving
    resolveWalletRequest({ address: '0xabc', privateKey: '0xdef' });

    const result = await promise;
    expect(result).toEqual({ address: '0xabc', privateKey: '0xdef' });

    window.removeEventListener('foid-wallet:request-create', eventSpy);
  });

  it('requestWalletUnlock dispatches event and resolves on callback', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('foid-wallet:request-unlock', eventSpy);

    const promise = requestWalletUnlock();
    expect(eventSpy).toHaveBeenCalledOnce();

    resolveWalletRequest({ address: '0x123', privateKey: '0x456' });

    const result = await promise;
    expect(result).toEqual({ address: '0x123', privateKey: '0x456' });

    window.removeEventListener('foid-wallet:request-unlock', eventSpy);
  });

  it('resolveWalletRequest with null resolves as cancel', async () => {
    const promise = requestWalletCreation();
    resolveWalletRequest(null);

    const result = await promise;
    expect(result).toBeNull();
  });

  it('resolveWalletRequest is no-op without pending request', () => {
    // Should not throw
    resolveWalletRequest({ address: '0x1', privateKey: '0x2' });
  });

  it('sequential requests do not leak', async () => {
    // First request
    const p1 = requestWalletCreation();
    resolveWalletRequest({ address: '0xa', privateKey: '0xb' });
    const r1 = await p1;
    expect(r1?.address).toBe('0xa');

    // Second request
    const p2 = requestWalletUnlock();
    resolveWalletRequest({ address: '0xc', privateKey: '0xd' });
    const r2 = await p2;
    expect(r2?.address).toBe('0xc');
  });
});
