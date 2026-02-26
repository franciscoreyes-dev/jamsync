import jwt from 'jsonwebtoken';
import { AppError } from '../errors';

export interface JwtPayload {
  hostId: string;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '24h' });
}

export function verifyJwt(token: string): JwtPayload {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    throw new AppError('INVALID_TOKEN', 401);
  }
}
