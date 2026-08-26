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

// 1. Fake In-Memory Database
const fakeDB = {
    "101": { id: "101", name: "Neel", role: "Fullstack Developer" },
    "102": { id: "102", name: "John", role: "Frontend Developer" }
};

// Simulate a slow database query (takes 3 seconds)
const fetchUserFromDB = async (id) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(fakeDB[id]);
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
    type Mutation {
        updateUser(id: ID!, name: String, role: String): User
    }
`;

const resolvers = {
    Query: {
        hello: () => 'Hello from GraphQL inside Docker!',
        healthCheck: () => 'Server, GraphQL, and Redis are ready!',
        getUser: async (_, { id }) => {
            const cacheKey = `user:${id}`;
            const cachedUser = await redis.get(cacheKey);

            if (cachedUser) {
                console.log('🚀 Returning from Redis Cache');
                return JSON.parse(cachedUser);
            }

            console.log('🐢 Fetching from slow Database...');
            const user = await fetchUserFromDB(id);

            if (user) {
                await redis.set(cacheKey, JSON.stringify(user), 'EX', 60);
                return user;
            } else {
                throw new Error('User not found');
            }
        },
    },
    Mutation: {
        updateUser: async (_, { id, name, role }) => {
            // Update our fake database
            if (!fakeDB[id]) throw new Error("User not found");
            if (name) fakeDB[id].name = name;
            if (role) fakeDB[id].role = role;

            // INVALIDATE THE CACHE: Delete the old data from Redis!
            const cacheKey = `user:${id}`;
            await redis.del(cacheKey);
            console.log(`🗑️ Cache invalidated for ${cacheKey}`);

            return fakeDB[id];
        }
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