FROM node:22-alpine

ENV CI=true

WORKDIR /app

COPY . .

# hadolint ignore=DL3018
RUN corepack enable \
  && corepack prepare pnpm@10.33.2 --activate \
  && apk update && apk upgrade \
  && apk add --no-cache \
  mysql-client \
  mariadb-client \
  mariadb-connector-c \
  bash \
  && wget https://github.com/heronlabs/aws-env/raw/master/bin/aws-env-linux-amd64 -q -O /bin/aws-env \
  && chmod +x /bin/aws-env \
  && pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm store prune

# Make hcli available system-wide
RUN printf '#!/bin/sh\nexec node /app/bin/src/main.js "$@"\n' > /usr/local/bin/hcli \
  && chmod +x /usr/local/bin/hcli

# Write cron job: backup every 12 hours
# Sources /etc/environment so crond inherits runtime env vars (injected by EasyPanel)
RUN printf '0 */12 * * *\t. /etc/environment; hcli mysql-backup\n' \
  > /etc/crontabs/root

# 1. Dump runtime env vars for crond (which doesn't inherit the parent process env)
# 2. Run an immediate backup at container start
# 3. Start crond in foreground to keep the container alive
CMD ["sh", "-c", "printenv > /etc/environment && hcli mysql-backup && crond -f -d 8"]
