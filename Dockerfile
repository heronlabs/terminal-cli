FROM node:22-alpine

ENV CI=true

WORKDIR /app

COPY . .

# hadolint ignore=DL3018
RUN corepack enable \
  && corepack prepare pnpm@10.33.2 --activate \
  && apk update && apk upgrade \
  && apk add --no-cache \
  postgresql-client \
  mysql-client \
  bash \
  && pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm store prune \
  && printf '#!/bin/sh\nexec node /app/bin/src/main.js "$@"\n' > /usr/local/bin/hcli \
  && chmod +x /usr/local/bin/hcli

CMD ["bash"]
