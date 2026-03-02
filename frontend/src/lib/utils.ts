import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decodes the JWT stored in localStorage and returns the hostId claim.
 * Returns null if the token is absent, malformed, or missing the claim.
 * The token is not cryptographically verified here — the backend does that.
 */
export function getHostIdFromJwt(): string | null {
  try {
    const token = localStorage.getItem('jamsync_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
    return typeof payload.hostId === 'string' ? payload.hostId : null;
  } catch {
    return null;
  }
}
