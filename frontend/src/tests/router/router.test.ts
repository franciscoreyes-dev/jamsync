import { describe, it, expect } from 'vitest';
import { router } from '@/router';

describe('router routes', () => {
  it('resolves / to home', () => {
    expect(router.resolve('/').name).toBe('home');
  });

  it('resolves /host/new to host-new', () => {
    expect(router.resolve('/host/new').name).toBe('host-new');
  });

  it('resolves /host/:id to host', () => {
    expect(router.resolve('/host/room-123').name).toBe('host');
  });

  it('resolves /join/:code to join', () => {
    expect(router.resolve('/join/JAM-XXXX').name).toBe('join');
  });

  it('resolves /room/:code to guest', () => {
    expect(router.resolve('/room/JAM-XXXX').name).toBe('guest');
  });

  it('resolves /auth/error to auth-error', () => {
    expect(router.resolve('/auth/error').name).toBe('auth-error');
  });
});
