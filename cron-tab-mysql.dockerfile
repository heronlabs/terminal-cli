# syntax=docker/dockerfile:1

# ---- builder: install all deps, compile, then prune to prod-only deps ----
FROM node:22.20.0-alpine AS builder

ENV CI=true
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json tsconfig.bin.json ./
COPY src ./src

RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm prune --prod

# ---- runtime: MySQL/MariaDB backup cron, compiled output + prod deps only ----
FROM node:22.20.0-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# aws-env is pinned to an immutable commit (was a mutable `master` ref).
# hadolint ignore=DL3018
RUN apk add --no-cache \
  mysql-client \
  mariadb-client \
  mariadb-connector-c \
  bash \
  && wget https://github.com/heronlabs/aws-env/raw/3960d830b2e27cb3ec9c065b761df627f7c55976/bin/aws-env-linux-amd64 -q -O /bin/aws-env \
  && chmod +x /bin/aws-env

COPY --from=builder /app/bin ./bin
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Make hcli available system-wide
RUN printf '#!/bin/sh\nexec node /app/bin/src/main.js "$@"\n' > /usr/local/bin/hcli \
  && chmod +x /usr/local/bin/hcli

# Write cron job: backup every 12 hours
# Sources /etc/environment so crond inherits runtime env vars (injected by EasyPanel)
RUN printf '0 */12 * * *\t. /etc/environment; hcli mysql-backup\n' \
  > /etc/crontabs/root

# 1. Dump runtime env vars for crond (which doesn't inherit the parent process env)
#    and restrict the file to root (it contains DB + AWS credentials)
# 2. Run an immediate backup at container start
# 3. Start crond in foreground to keep the container alive
CMD ["sh", "-c", "printenv > /etc/environment && chmod 600 /etc/environment && hcli mysql-backup && crond -f -d 8"]
