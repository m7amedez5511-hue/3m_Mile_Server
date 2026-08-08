
const redisUrl = new URL(process.env.REDIS_URL || "redis://redis:6379");

export const redisConnectionConfig = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
};