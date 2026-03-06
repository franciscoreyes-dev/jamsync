import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export async function saveHostSession(
  hostId: string,
  tokens: { hostToken: string; hostRefreshToken: string; spotifyId: string }
): Promise<void> {
  const key = `session:${hostId}`;
  await redis.hset(key, 'hostToken', tokens.hostToken, 'hostRefreshToken', tokens.hostRefreshToken, 'spotifyId', tokens.spotifyId);
  await redis.expire(key, 86400);
}

export async function getHostSession(
  hostId: string
): Promise<{ hostToken: string; hostRefreshToken: string; spotifyId: string } | null> {
  const data = await redis.hgetall(`session:${hostId}`);
  if (!data.hostToken) return null;
  return { hostToken: data.hostToken, hostRefreshToken: data.hostRefreshToken, spotifyId: data.spotifyId };
}

export async function deleteHostSession(hostId: string): Promise<void> {
  await redis.del(`session:${hostId}`);
}
