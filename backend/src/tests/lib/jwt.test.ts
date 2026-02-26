import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '../../lib/jwt';
import { AppError } from '../../errors';

process.env.JWT_SECRET = 'test-secret';

describe('signJwt', () => {
  it('returns a string token', () => {
    const token = signJwt({ hostId: 'h1' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyJwt', () => {
  it('returns the payload for a valid token', () => {
    const token = signJwt({ hostId: 'h1' });
    const payload = verifyJwt(token);
    expect(payload.hostId).toBe('h1');
  });

  it('throws AppError(INVALID_TOKEN) for an invalid token', () => {
    expect(() => verifyJwt('bad.token.here')).toThrow(AppError);
    expect(() => verifyJwt('bad.token.here')).toThrowError(
      expect.objectContaining({ code: 'INVALID_TOKEN' })
    );
  });
});
