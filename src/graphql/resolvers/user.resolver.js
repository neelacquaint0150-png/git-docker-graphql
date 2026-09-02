import { redis } from '../../config/redis.js';
import { prisma } from '../../db/prisma.js';
import { fakeDB, fetchUserFromDB } from '../../db/fakeDb.js';

export const userResolver = {
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
      return context.postLoader.load(parent.id);
    },
  },
  Mutation: {
    updateUser: async (_, { id, name, role }) => {
      if (!fakeDB[id]) throw new Error("User not found");
      if (name) fakeDB[id].name = name;
      if (role) fakeDB[id].role = role;

      const cacheKey = `user:${id}`;
      await redis.del(cacheKey);
      console.log(`🗑️ Cache invalidated for ${cacheKey}`);

      return fakeDB[id];
    },
    createUser: async (_, { name, email }) => {
      return prisma.user.create({ data: { name, email } });
    },
  },
};