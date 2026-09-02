import DataLoader from 'dataloader';
import { prisma } from '../db/prisma.js';

const batchPostsByUserId = async (userIds) => {
  console.log(`⚡ [DataLoader Executed] Batching DB fetch for user IDs: [${userIds.join(', ')}]`);

  const posts = await prisma.post.findMany({
    where: { authorId: { in: userIds } },
  });

  return userIds.map((id) => posts.filter((post) => post.authorId === id));
};

export const createPostLoader = () => new DataLoader(batchPostsByUserId);