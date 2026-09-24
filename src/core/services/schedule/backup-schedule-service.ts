import {Injectable, Logger} from '@nestjs/common';
import {Cron} from 'croner';

import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {BackupService} from '../../interfaces/backup-service';
import {JobRunnerService} from '../job/job-runner-service';
import {MysqlBackupService} from '../mysql/mysql-backup-service';
import {PsqlBackupService} from '../psql/psql-backup-service';

@Injectable()
export class BackupScheduleService {
  private cron?: Cron;
  private inFlight: Promise<unknown> = Promise.resolve();

  async start(): Promise<boolean> {
    const {engine, backup, backupOnStart} = this.environmentService.schedule;
    const service = this.serviceFor(engine);

    if (!service) {
      this.logger.error('BACKUP_ENGINE must be psql or mysql');
      return false;
    }

    try {
      this.cron = new Cron(
        backup,
        {timezone: 'UTC', protect: true},
        async () => {
          await this.backup(service);
        },
      );
    } catch (error) {
      this.logger.error(
        `Invalid BACKUP_SCHEDULE "${backup}": ${(error as Error).message}`,
      );
      return false;
    }

    if (backupOnStart) {
      await this.backup(service);
    }

    return true;
  }

  async stop(): Promise<void> {
    this.cron?.stop();
    await this.inFlight;
  }

  private backup(service: BackupService) {
    this.inFlight = this.jobRunner.run(
      {
        command: 'run',
        job: 'backup',
        trigger: 'schedule',
        lock: true,
        monitored: true,
      },
      () => service.run(false),
    );

    return this.inFlight;
  }

  private serviceFor(engine: string | undefined): BackupService | undefined {
    if (engine === 'psql') {
      return this.psqlBackupService;
    }

    if (engine === 'mysql') {
      return this.mysqlBackupService;
    }

    return undefined;
  }

  constructor(
    private readonly logger: Logger,
    private readonly environmentService: EnvironmentService,
    private readonly jobRunner: JobRunnerService,
    private readonly psqlBackupService: PsqlBackupService,
    private readonly mysqlBackupService: MysqlBackupService,
  ) {}
}
