#!/usr/bin/env node
import 'reflect-metadata';

import {CommandFactory} from 'nest-commander';
import {Logger as PinoLogger} from 'nestjs-pino';

import {CliModule} from './application/cli/cli-module';

const bootstrap = async () => {
  const app = await CommandFactory.createWithoutRunning(CliModule);

  app.useLogger(app.get(PinoLogger));

  await CommandFactory.runApplication(app);
};

void bootstrap();
