import { userResolver } from './user.resolver.js';
import { authResolver } from './auth.resolver.js';
import { postResolver } from './post.resolver.js';

export const resolvers = {
  Query: {
    ...userResolver.Query,
  },
  DBUser: {
    ...userResolver.DBUser,
  },
  Mutation: {
    ...userResolver.Mutation,
    ...authResolver.Mutation,
    ...postResolver.Mutation,
  },
  Subscription: {
    ...postResolver.Subscription,
  },
};