import {Injectable, Logger} from '@nestjs/common';
import {randomUUID} from 'crypto';

import {JobContextService} from '../../../infrastructure/monitoring/services/job-context-service';
import {MonitoringService} from '../../../infrastructure/monitoring/services/monitoring-service';
import {JobOptions, JobOutcome, JobResult} from '../../types/job';
import {JobLockService} from './job-lock-service';

@Injectable()
export class JobRunnerService {
  run(options: JobOptions, fn: () => Promise<JobResult>): Promise<JobOutcome> {
    return this.jobContext.run(
      {
        command: options.command,
        job: options.job,
        'job.id': randomUUID(),
        trigger: options.trigger,
      },
      () => this.execute(options, fn),
    );
  }

  private async execute(
    options: JobOptions,
    fn: () => Promise<JobResult>,
  ): Promise<JobOutcome> {
    if (options.lock && !this.jobLock.acquire()) {
      this.logger.warn(
        `${options.job} skipped: another backup or rollup is running`,
      );
      return 'skipped';
    }

    const checkInId = options.monitored
      ? this.monitoring.startCheckIn()
      : undefined;

    this.logger.log(`${options.job} started`);

    try {
      const result = await this.settle(fn);

      this.monitoring.finishCheckIn(checkInId, result.ok);

      return this.report(options, result);
    } finally {
      if (options.lock) {
        this.jobLock.release();
      }
    }
  }

  private async settle(fn: () => Promise<JobResult>): Promise<JobResult> {
    try {
      return await fn();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));

      this.logger.error(failure.message);

      return {ok: false, error: failure};
    }
  }

  private report(options: JobOptions, result: JobResult): JobOutcome {
    if (result.ok) {
      this.logger.log(`${options.job} finished`);
      return 'ok';
    }

    if (result.expected) {
      this.logger.warn(result.error.message);
      return 'failed';
    }

    this.monitoring.captureError(result.error);

    return 'failed';
  }

  constructor(
    private readonly logger: Logger,
    private readonly jobLock: JobLockService,
    private readonly jobContext: JobContextService,
    private readonly monitoring: MonitoringService,
  ) {}
}
