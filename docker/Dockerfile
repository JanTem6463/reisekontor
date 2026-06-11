# ---- Stage 1: UI build ----
FROM node:22-alpine AS ui-builder
WORKDIR /build
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ui/package.json ./ui/
RUN pnpm install --frozen-lockfile --filter @reisekontor/ui...

COPY ui/ ./ui/
RUN pnpm --filter @reisekontor/ui build

# ---- Stage 2: Server deps ----
FROM node:22-alpine AS deps
WORKDIR /build
RUN corepack enable

# Build-Tools für better-sqlite3 native-binding
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ui/package.json ./ui/
RUN pnpm install --frozen-lockfile --prod --filter "!@reisekontor/ui"

# ---- Stage 3: Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/package.json ./

COPY src ./src
COPY config ./config

COPY --from=ui-builder /build/ui/dist ./public

RUN mkdir -p /app/data && chown -R node:node /app/data /app

USER node
EXPOSE 3030

CMD ["node", "node_modules/.bin/tsx", "src/server/index.ts"]
