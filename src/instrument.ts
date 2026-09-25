import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import * as Sentry from '@sentry/node';

const {version} = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
) as {version: string};

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  release: `terminal-cli@${version}`,
  sendDefaultPii: false,
  enableLogs: true,
  integrations: [Sentry.pinoIntegration({error: {levels: ['error']}})],
});
