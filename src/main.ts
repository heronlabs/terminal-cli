#!/usr/bin/env node
import 'reflect-metadata';

import * as Sentry from '@sentry/node';
import {CommandFactory} from 'nest-commander';
import {Logger as PinoLogger} from 'nestjs-pino';

import {CliModule} from './application/cli/cli-module';
import {MonitoringService} from './infrastructure/monitoring/services/monitoring-service';

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
  app.get(MonitoringService).init();

  await CommandFactory.runApplication(app).catch(fail);
  await app.close();
};

bootstrap().catch(fail);
