import { prisma } from '../../db/prisma.js';
import { pubsub } from '../../config/redis.js';

export const postResolver = {
  Mutation: {
    createPost: async (_, { title, authorId }) => {
      const newPost = await prisma.post.create({
        data: { title, authorId: Number(authorId) },
      });

      pubsub.publish('POST_CREATED', { postCreated: newPost });
      console.log(`📢 [Redis Pub/Sub] Published POST_CREATED event for Post ID: ${newPost.id}`);

      return newPost;
    },
  },
  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(['POST_CREATED']),
    },
  },
};