# Multi-stage Dockerfile for Llumen JIT Provisioner
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Dependencies
COPY package.json tsconfig.json ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Source code
COPY src/ ./src/

# Security hardening: run as non-root
USER bun

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

ENTRYPOINT ["bun", "run", "src/index.ts"]
