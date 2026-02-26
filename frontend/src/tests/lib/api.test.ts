import { describe, it, expect, beforeEach } from 'vitest';
import { getAuthHeader } from '@/lib/api';

describe('getAuthHeader', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns Authorization header when token is set', () => {
    localStorage.setItem('jamsync_token', 'test-jwt');
    expect(getAuthHeader()).toEqual({ Authorization: 'Bearer test-jwt' });
  });

  it('returns empty object when no token', () => {
    expect(getAuthHeader()).toEqual({});
  });
});
