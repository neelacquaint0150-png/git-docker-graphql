export const typeDefs = `#graphql
  type OTPResponse {
      success: Boolean!
      message: String!
  }
  
  type User {
      id: ID!
      name: String
      role: String
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

  type Query {
      hello: String
      healthCheck: String
      getUser(id: ID!): User
      users: [DBUser!]!
  }

  type Mutation {
      updateUser(id: ID!, name: String, role: String): User
      sendOTP(phone: String!): OTPResponse!
      verifyOTP(phone: String!, code: String!): OTPResponse!
      createUser(name: String!, email: String!): DBUser!
      createPost(title: String!, authorId: Int!): DBPost! 
  }

  type Subscription {
      postCreated: DBPost!
  }
`;