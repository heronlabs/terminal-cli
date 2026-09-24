import {Injectable, OnApplicationShutdown} from '@nestjs/common';
import * as Sentry from '@sentry/node';

import {EnvironmentService} from '../../environment/services/environment-service';
import {JobContextService} from './job-context-service';
import {SecretScrubberService} from './secret-scrubber-service';

const FLUSH_TIMEOUT_MS = 2000;
const CHECKIN_MARGIN_MINUTES = 5;

@Injectable()
export class MonitoringService implements OnApplicationShutdown {
  private enabled = false;

  init(): boolean {
    const {dsn, environment} = this.environmentService.monitoring;

    if (!dsn) {
      return false;
    }

    Sentry.init({
      dsn,
      environment,
      release: this.environmentService.release,
      sendDefaultPii: false,
      enableLogs: true,
      beforeSend: event => this.scrubber.scrubObject(event),
      beforeSendLog: log => this.scrubber.scrubObject(log),
    });

    this.enabled = true;

    return true;
  }

  log(level: 'info' | 'warn' | 'error', message: string): void {
    if (!this.enabled) {
      return;
    }

    Sentry.logger[level](message, this.jobContext.current());
  }

  captureError(error: unknown): void {
    if (!this.enabled) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setTags(this.jobContext.current() ?? {});
      Sentry.captureException(error);
    });
  }

  startCheckIn(): string | undefined {
    const {monitorSlug} = this.environmentService.monitoring;

    if (!this.enabled || !monitorSlug) {
      return undefined;
    }

    return Sentry.captureCheckIn(
      {monitorSlug, status: 'in_progress'},
      this.monitorConfig(),
    );
  }

  finishCheckIn(checkInId: string | undefined, ok: boolean): void {
    const {monitorSlug} = this.environmentService.monitoring;

    if (!checkInId || !monitorSlug) {
      return;
    }

    Sentry.captureCheckIn(
      {checkInId, monitorSlug, status: ok ? 'ok' : 'error'},
      this.monitorConfig(),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await Sentry.flush(FLUSH_TIMEOUT_MS);
  }

  private monitorConfig() {
    return {
      schedule: {
        type: 'crontab' as const,
        value: this.environmentService.schedule.backup,
      },
      checkinMargin: CHECKIN_MARGIN_MINUTES,
      maxRuntime: this.environmentService.monitoring.maxRuntimeMinutes,
      timezone: 'UTC',
    };
  }

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly jobContext: JobContextService,
    private readonly scrubber: SecretScrubberService,
  ) {}
}
