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

// Simulate a slow database query (takes 3 seconds)
const fetchUserFromDB = async (id) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ id, name: 'Neel', role: 'Fullstack Developer' });
        }, 3000);
    });
};

// GraphQL Schema & Resolvers
const typeDefs = `#graphql
    type User {
        id:ID!
        name:String
        role:String
    }
    type Query{
        hello:String
        healthCheck:String
        getUser(id:ID!):User
    }
`;

const resolvers = {
    Query: {
        hello: () => 'Hello from GraphQL inside Docker!',
        healthCheck: () => 'Server, GraphQL, and Redis are ready!',
        getUser: async (_, { id }) => {
            const cacheKey = `user:${id}`;

            // 1. Check if data exists in Redis cache
            const cachedUser = await redis.get(cacheKey);

            if (cachedUser) {
                console.log('🚀 Returning data from Redis Cache');
                return JSON.parse(cachedUser);
            }

            // 2. If not in cache, fetch from "DB" (Simulated 3s delay)
            console.log('🐢 Fetching data from slow Database...');
            const user = await fetchUserFromDB(id);

            // 3. Save to Redis cache for future requests (Expires in 60 seconds)
            await redis.set(cacheKey, JSON.stringify(user), 'EX', 60);

            return user;
        },
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