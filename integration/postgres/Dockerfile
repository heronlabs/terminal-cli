FROM node:22.22.3-alpine3.24@sha256:9385cd9f3001dfc3431e8ead12c43e9e1f87cc1b9b5c6cfd0f73865d405b27c4 AS builder

ENV CI=true
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json tsconfig.bin.json ./
COPY src ./src

RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm prune --prod

FROM node:22.22.3-alpine3.24@sha256:9385cd9f3001dfc3431e8ead12c43e9e1f87cc1b9b5c6cfd0f73865d405b27c4 AS runtime

ENV NODE_ENV=production
WORKDIR /app

# hadolint ignore=DL3018
RUN apk upgrade --no-cache \
  && apk add --no-cache postgresql-client bash

COPY --from=builder /app/bin ./bin
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY integration ./integration

RUN printf '#!/bin/sh\nexec node /app/bin/src/main.js "$@"\n' > /usr/local/bin/hcli \
  && chmod +x /usr/local/bin/hcli \
  && chown -R node:node /app

USER node

CMD ["bash", "integration/postgres/roundtrip.sh"]
