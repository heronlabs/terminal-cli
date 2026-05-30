FROM node:22.20.0-alpine AS builder

ENV CI=true
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json tsconfig.bin.json ./
COPY src ./src

RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm prune --prod

FROM node:22.20.0-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache \
  mysql-client \
  mariadb-client \
  mariadb-connector-c \
  bash

COPY --from=builder /app/bin ./bin
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN printf '#!/bin/sh\nexec node /app/bin/src/main.js "$@"\n' > /usr/local/bin/hcli \
  && chmod +x /usr/local/bin/hcli

RUN printf '0 */12 * * *\t. /etc/environment; hcli mysql-backup\n' > /etc/crontabs/root

CMD ["sh", "-c", "printenv > /etc/environment && chmod 600 /etc/environment && hcli mysql-backup && crond -f -d 8"]
