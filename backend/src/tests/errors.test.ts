import { describe, it, expect } from 'vitest';
import { AppError } from '../errors';

describe('AppError', () => {
  it('stores code and statusCode', () => {
    const err = new AppError('PREMIUM_REQUIRED', 403);
    expect(err.code).toBe('PREMIUM_REQUIRED');
    expect(err.statusCode).toBe(403);
    expect(err).toBeInstanceOf(Error);
  });

  it('is distinguishable from a plain Error', () => {
    const err = new AppError('TEST', 400);
    expect(err instanceof AppError).toBe(true);
    expect(new Error('x') instanceof AppError).toBe(false);
  });
});
