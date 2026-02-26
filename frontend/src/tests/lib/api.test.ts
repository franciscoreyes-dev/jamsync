import { describe, it, expect, beforeEach } from 'vitest';

describe('getAuthHeader', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns Authorization header when token is set', async () => {
    localStorage.setItem('jamsync_token', 'test-jwt');
    const { getAuthHeader } = await import('@/lib/api');
    expect(getAuthHeader()).toEqual({ Authorization: 'Bearer test-jwt' });
  });

  it('returns empty object when no token', async () => {
    const { getAuthHeader } = await import('@/lib/api');
    expect(getAuthHeader()).toEqual({});
  });
});
