# syntax=docker/dockerfile:1

# ---- builder: install all deps, compile, then prune to prod-only deps ----
FROM node:22.20.0-alpine AS builder

ENV CI=true
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Copy only what the build needs (the rest is excluded via .dockerignore).
COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json tsconfig.bin.json ./
COPY src ./src

RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm prune --prod

# ---- runtime: compiled output + prod deps + db clients only, non-root ----
FROM node:22.20.0-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# hadolint ignore=DL3018
RUN apk add --no-cache \
  postgresql-client \
  mysql-client \
  mariadb-client \
  mariadb-connector-c \
  bash

# No source, no source maps — only the comment-stripped compiled bundle ships.
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN printf '#!/bin/sh\nexec node /app/bin/src/main.js "$@"\n' > /usr/local/bin/hcli \
  && chmod +x /usr/local/bin/hcli \
  && chown -R node:node /app

USER node

CMD ["bash"]
