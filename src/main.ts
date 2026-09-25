#!/usr/bin/env node
import './instrument';
import 'reflect-metadata';

import * as Sentry from '@sentry/node';
import {CommandFactory} from 'nest-commander';
import {Logger as PinoLogger} from 'nestjs-pino';

import {CliModule} from './application/cli/cli-module';

const fail = (error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  Sentry.captureException(error);
  process.exitCode = 1;
};

const bootstrap = async () => {
  const app = await CommandFactory.createWithoutRunning(CliModule, {
    serviceErrorHandler: fail,
  });

  app.useLogger(app.get(PinoLogger));

  await CommandFactory.runApplication(app).catch(fail);
  await app.close();
};

bootstrap()
  .catch(fail)
  .finally(() => Sentry.flush(2000));
