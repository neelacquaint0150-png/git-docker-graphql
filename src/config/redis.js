import Redis from 'ioredis';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

export const redisOptions = {
  host: redisHost,
  port: Number(redisPort),
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

export const redis = new Redis(redisOptions);

export const pubsub = new RedisPubSub({
  publisher: new Redis(redisOptions),
  subscriber: new Redis(redisOptions),
});

redis.on('connect', () => console.log('⚡ Connected to Redis successfully!'));
redis.on('error', (err) => console.error('Redis error:', err.message));