# Stage 1: Build Dependencies & Generate Prisma Client
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
RUN npm install
COPY . .

# Stage 2: Production Lightweight Image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled Prisma client and app source from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

# Security: Switch from root user to unprivileged 'node' user
USER node

EXPOSE 4000
CMD ["npm", "start"]