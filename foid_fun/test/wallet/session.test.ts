import { describe, it, expect, beforeEach } from 'vitest';

// Session module uses Web Workers which aren't available in test env.
// We test the fallback (encrypted in-memory) behavior.

describe('session (fallback mode)', () => {
  beforeEach(async () => {
    // Dynamic import to reset module state between tests
    const session = await import('@/lib/wallet/session');
    await session.clearSession();
  });

  it('getSession returns null initially', async () => {
    const { getSession } = await import('@/lib/wallet/session');
    expect(getSession()).toBeNull();
  });

  it('setSession + getSession roundtrip', async () => {
    const { setSession, getSession } = await import('@/lib/wallet/session');
    await setSession('0xabcdef', '0x1234');
    const session = getSession();
    expect(session).not.toBeNull();
    expect(session!.address).toBe('0x1234');
    // In worker/fallback mode, privateKey is sentinel
    expect(session!.privateKey).toBe('__WORKER_MANAGED__');
  });

  it('clearSession invalidates session', async () => {
    const { setSession, getSession, clearSession } = await import('@/lib/wallet/session');
    await setSession('0xabcdef', '0x1234');
    expect(getSession()).not.toBeNull();
    await clearSession();
    expect(getSession()).toBeNull();
  });
});
