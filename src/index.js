import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import Redis from 'ioredis';
import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// DataLoader function to resolve the N+1 problem
// Instead of 10 SQL queries for 10 users, this combines user IDs into 1 query:
// SELECT * FROM "Post" WHERE "authorId" IN (1, 2, 3...)
const batchPostsByUserId = async (userIds) => {
    console.log(`⚡ [DataLoader Executed] Batching DB fetch for user IDs: [${userIds.join(', ')}]`);

    const posts = await prisma.post.findMany({
        where: { authorId: { in: userIds } },
    });

    return userIds.map((id) => posts.filter((post) => post.authorId === id));
};

// GraphQL Schema & Resolvers
const typeDefs = `#graphql
    type OTPResponse {
        success: Boolean!
        message: String!
    }
    type User {
        id:ID!
        name:String
        role:String
    }

    type DBUser {
        id: ID!
        name: String!
        email: String!
        posts: [DBPost!]!
    }

    type DBPost {
        id: ID!
        title: String!
        authorId: Int!
    }
    type Query{
        hello:String
        healthCheck:String
        getUser(id:ID!):User
        users: [DBUser!]!
    }
    type Mutation {
        updateUser(id: ID!, name: String, role: String): User
        sendOTP(phone: String!): OTPResponse!
        verifyOTP(phone: String!, code: String!): OTPResponse!
        createUser(name: String!, email: String!): DBUser!
        createPost(title: String!, authorId: Int!): DBPost! 
    }
`;

// Helper: Send SMS via HttpSMS API
async function sendSMSViaHttpSMS(toPhone, message) {
    const apiKey = process.env.HTTPSMS_API_KEY;
    const fromPhone = process.env.HTTPSMS_FROM_NUMBER;
    console.log(`API KEY : ${apiKey}`);
    console.log(`From Phone : ${fromPhone}`);
    console.log(`To Phone : ${toPhone}`);
    console.log(`Message : ${message}`);

    if (!apiKey || apiKey === 'your_httpsms_api_key_here') {
        console.log(`\n========================================`);
        console.log(`[DEV MODE] HttpSMS API key missing.`);
        console.log(`Simulated SMS to ${toPhone}: "${message}"`);
        console.log(`========================================\n`);
        return { status: 'simulated' };
    }

    const response = await fetch('https://api.httpsms.com/v1/messages/send', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: fromPhone,
            to: toPhone,
            content: message,
        }),
    });

    const data = await response.json();
    console.log('HttpSMS response status:', response.status);
    console.log('HttpSMS response ok:', response.ok);
    console.log('HttpSMS response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
        console.log(`data.from[0] + data.from[1] : ${data.from[0] + data.from[1]}`);

        const errorMessage =
            typeof data === 'object'
                ? data.from[0] + data.from[1] ||
                data.message ||
                data.error ||
                JSON.stringify(data)
                : data;
        console.log(` errorMessage : ${errorMessage}`);

        // throw new Error(errorMessage);
    }

    return data;
}

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
        users: async () => prisma.user.findMany(),
    },
    DBUser: {
        posts: (parent, _, context) => {
            // Passes fetching responsibility to DataLoader context
            return context.postLoader.load(parent.id);
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
        },
        sendOTP: async (_, { phone }) => {
            // 1. Generate random 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const redisKey = `otp:${phone}`;

            // 2. Save OTP in Redis with 300-second (5 min) expiry
            await redis.set(redisKey, otpCode, 'EX', 300);
            console.log(`🔑 OTP generated for ${phone}: ${otpCode}`);

            // 3. Send SMS using HttpSMS API
            try {
                await sendSMSViaHttpSMS(
                    phone,
                    `Your verification code is: ${otpCode}. Valid for 5 minutes.`
                );
                return {
                    success: true,
                    message: `OTP sent successfully to ${phone}`,
                };
            } catch (error) {
                console.error('HttpSMS Error:', error.message);
                return {
                    success: false,
                    message: `Failed to dispatch SMS: ${error.message}`,
                };
            }
        },

        verifyOTP: async (_, { phone, code }) => {
            const redisKey = `otp:${phone}`;
            const storedOTP = await redis.get(redisKey);

            if (!storedOTP) {
                return {
                    success: false,
                    message: 'OTP has expired or was never requested.',
                };
            }

            if (storedOTP !== code) {
                return {
                    success: false,
                    message: 'Invalid OTP code. Please try again.',
                };
            }

            // Delete OTP after successful verification (Prevent reuse)
            await redis.del(redisKey);

            return {
                success: true,
                message: 'Phone number verified successfully!',
            };
        },

        createUser: async (_, { name, email }) => {
            return prisma.user.create({ data: { name, email } });
        },
        createPost: async (_, { title, authorId }) => {
            return prisma.post.create({ data: { title, authorId: Number(authorId) } });
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
    expressMiddleware(server, {
        // Inject fresh DataLoader instance into GraphQL Context per request
        context: async () => ({
            postLoader: new DataLoader(batchPostsByUserId),
        }),
    })
);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`🚀 GraphQL Server running at http://localhost:${PORT}/graphql`);
});