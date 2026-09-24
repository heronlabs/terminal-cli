import {Logger} from '@nestjs/common';
import {Command, CommandRunner} from 'nest-commander';

import {BackupListService} from '../../../../core/services/backup-list/backup-list-service';
import {JobRunnerService} from '../../../../core/services/job/job-runner-service';

const BYTES_PER_MB = 1024 * 1024;

@Command({
  name: 'backups-list',
  description: 'List the backups of the configured database, newest first',
})
export class BackupsListCommand extends CommandRunner {
  public async run() {
    const outcome = await this.jobRunner.run(
      {
        command: 'backups-list',
        job: 'backups-list',
        trigger: 'manual',
        lock: false,
      },
      async () => {
        const result = await this.backupListService.list();

        if (!result.ok) {
          this.logger.error(result.error.message);
          return result;
        }

        if (result.backups.length === 0) {
          process.stdout.write(`No backups found for ${result.name}\n`);
        }

        result.backups.forEach(({key, size, lastModified}) => {
          process.stdout.write(
            `${lastModified.toISOString()}  ${key}  ${(size / BYTES_PER_MB).toFixed(1)} MB\n`,
          );
        });

        return {ok: true as const};
      },
    );

    if (outcome !== 'ok') {
      process.exitCode = 1;
    }
  }

  constructor(
    private readonly logger: Logger,
    private readonly backupListService: BackupListService,
    private readonly jobRunner: JobRunnerService,
  ) {
    super();
  }
}
