#!/usr/bin/env node
import 'reflect-metadata';

import {CommandFactory} from 'nest-commander';
import {Logger as PinoLogger} from 'nestjs-pino';

import {CliModule} from './application/cli/cli-module';

const fail = (error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
};

const bootstrap = async () => {
  const app = await CommandFactory.createWithoutRunning(CliModule, {
    serviceErrorHandler: fail,
  });

  app.useLogger(app.get(PinoLogger));

  await CommandFactory.runApplication(app);
};

bootstrap().catch(fail);
