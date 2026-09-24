import {Injectable, LoggerService} from '@nestjs/common';
import {Logger as PinoLogger} from 'nestjs-pino';

import {MonitoringService} from '../../monitoring/services/monitoring-service';

@Injectable()
export class BridgeLoggerService implements LoggerService {
  log(message: unknown, ...optional: unknown[]) {
    this.pino.log(message, ...optional);
    this.monitoring.log('info', String(message));
  }

  warn(message: unknown, ...optional: unknown[]) {
    this.pino.warn(message, ...optional);
    this.monitoring.log('warn', String(message));
  }

  error(message: unknown, ...optional: unknown[]) {
    this.pino.error(message, ...optional);
    this.monitoring.log('error', String(message));
  }

  debug(message: unknown, ...optional: unknown[]) {
    this.pino.debug(message, ...optional);
  }

  verbose(message: unknown, ...optional: unknown[]) {
    this.pino.verbose(message, ...optional);
  }

  constructor(
    private readonly pino: PinoLogger,
    private readonly monitoring: MonitoringService,
  ) {}
}
