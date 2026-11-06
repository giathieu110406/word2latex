# Multi-stage Dockerfile for Word2LaTeX (Vite React + Express Backend)

# Stage 1: Build Frontend and Server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy the entire codebase
COPY . .

# Build Vite frontend and bundle server via esbuild into dist/
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled frontend and bundled server from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/api ./api

# Cloud Run automatically sets the PORT environment variable (default 8080)
EXPOSE 8080

# Start server
CMD ["node", "dist/server.cjs"]
