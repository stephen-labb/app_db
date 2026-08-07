# ==========================================
# Stage 1: Build stage
# ==========================================
FROM cgr.dev/chainguard/wolfi-base:latest AS builder

# Install build-time dependencies (Node.js, NPM, Git)
RUN apk update && apk add --no-cache nodejs-22 npm git

WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install all dependencies (including devDependencies for esbuild & vite compilation)
RUN npm install

# Copy application source files
COPY . .

# Run production compilation
# (This outputs the static client assets and compiles the backend server to dist/server.cjs)
RUN npm run build

# ==========================================
# Stage 2: Production runtime stage
# ==========================================
FROM cgr.dev/chainguard/wolfi-base:latest

# Install minimal Node.js runtime and temporarily NPM to download production dependencies
RUN apk update && apk add --no-cache nodejs-22 npm

WORKDIR /app

# Copy compiled distribution bundle and package lock files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies, then remove npm to minimize attack surface
RUN npm install --omit=dev && apk del npm

# Configure a secure non-root user and set permissions
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

# Expose standard routing port (3000)
EXPOSE 3000

# Set Node production environment
ENV NODE_ENV=production

# Boot the compiled server
CMD ["node", "dist/server.cjs"]
