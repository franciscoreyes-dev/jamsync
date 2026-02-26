import { describe, it, expect, vi } from 'vitest';

// Mock ioredis before importing the service
vi.mock('ioredis', () => {
  const store: Record<string, Record<string, string>> = {};

  const MockRedis = vi.fn().mockImplementation(() => ({
    hset: vi.fn(async (key: string, ...args: string[]) => {
      store[key] ??= {};
      for (let i = 0; i < args.length; i += 2) {
        store[key][args[i]] = args[i + 1];
      }
    }),
    expire: vi.fn(async () => 1),
    hgetall: vi.fn(async (key: string) => store[key] ?? {}),
    del: vi.fn(async (key: string) => { delete store[key]; return 1; }),
  }));

  return { default: MockRedis };
});

import { saveHostSession, getHostSession, deleteHostSession } from '../../services/redis';

describe('saveHostSession', () => {
  it('stores tokens under session:{hostId}', async () => {
    await expect(
      saveHostSession('host-1', { hostToken: 'at', hostRefreshToken: 'rt' })
    ).resolves.not.toThrow();
  });
});

describe('getHostSession', () => {
  it('returns tokens for an existing session', async () => {
    await saveHostSession('host-2', { hostToken: 'at2', hostRefreshToken: 'rt2' });
    const session = await getHostSession('host-2');
    expect(session).toEqual({ hostToken: 'at2', hostRefreshToken: 'rt2' });
  });

  it('returns null when session does not exist', async () => {
    const session = await getHostSession('nonexistent');
    expect(session).toBeNull();
  });
});

describe('deleteHostSession', () => {
  it('removes the session', async () => {
    await saveHostSession('host-3', { hostToken: 'at3', hostRefreshToken: 'rt3' });
    await deleteHostSession('host-3');
    const session = await getHostSession('host-3');
    expect(session).toBeNull();
  });
});
