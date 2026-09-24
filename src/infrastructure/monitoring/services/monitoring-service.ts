import {Injectable, OnApplicationShutdown} from '@nestjs/common';
import * as Sentry from '@sentry/node';

import {EnvironmentService} from '../../environment/services/environment-service';

@Injectable()
export class MonitoringService implements OnApplicationShutdown {
  private enabled = false;

  init() {
    const {dsn, environment} = this.environmentService.monitoring;

    if (!dsn) {
      return;
    }

    Sentry.init({
      dsn,
      environment,
      release: this.environmentService.release,
      sendDefaultPii: false,
    });

    this.enabled = true;
  }

  captureError(error: Error) {
    if (this.enabled) {
      Sentry.captureException(error);
    }
  }

  async onApplicationShutdown() {
    if (this.enabled) {
      await Sentry.flush(2000);
    }
  }

  constructor(private readonly environmentService: EnvironmentService) {}
}
