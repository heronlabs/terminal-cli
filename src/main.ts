#!/usr/bin/env node
import 'reflect-metadata';

import * as Sentry from '@sentry/node';
import {CommandFactory} from 'nest-commander';

import {CliModule} from './application/cli/cli-module';
import {BridgeLoggerService} from './infrastructure/log/services/bridge-logger-service';
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

  app.useLogger(app.get(BridgeLoggerService));
  app.get(MonitoringService).init();

  try {
    await CommandFactory.runApplication(app);
  } finally {
    await app.close();
  }
};

bootstrap().catch(fail);
