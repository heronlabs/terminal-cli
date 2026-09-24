import {Command, CommandRunner} from 'nest-commander';

import {BackupScheduleService} from '../../../../core/services/schedule/backup-schedule-service';

@Command({
  name: 'run',
  description:
    'Run scheduled backups (BACKUP_ENGINE, BACKUP_SCHEDULE) until SIGTERM or SIGINT',
})
export class RunCommand extends CommandRunner {
  public async run() {
    if (!(await this.backupScheduleService.start())) {
      process.exitCode = 1;
      return;
    }

    await new Promise<void>(resolve => {
      process.once('SIGTERM', () => resolve());
      process.once('SIGINT', () => resolve());
    });

    await this.backupScheduleService.stop();
  }

  constructor(private readonly backupScheduleService: BackupScheduleService) {
    super();
  }
}
