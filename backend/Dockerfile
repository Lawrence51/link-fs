# syntax=docker/dockerfile:1
FROM node:18-alpine AS base
WORKDIR /app

# Use faster registry by default; can be overridden at build time
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

# Install deps (keep dev deps for ts-node-dev)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --legacy-peer-deps --loglevel=warn; fi

# Copy source
COPY tsconfig*.json ./
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev"]
