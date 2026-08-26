import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import Redis from 'ioredis';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Connect to Redis Container
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

export const redis = new Redis({
  host: redisHost,
  port: Number(redisPort),
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('connect', () => console.log('⚡ Connected to Redis successfully!'));
redis.on('error', (err) => console.error('Redis error:', err.message));

// GraphQL Schema & Resolvers
const typeDefs = `#graphql
  type Query {
    hello: String
    healthCheck: String
  }
`;

const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL inside Docker!',
    healthCheck: () => 'Server, GraphQL, and Redis are ready!',
  },
}; 

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await server.start();

app.use(
  '/graphql',
  cors(),
  express.json(),
  expressMiddleware(server)
);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 GraphQL Server running at http://localhost:${PORT}/graphql`);
});