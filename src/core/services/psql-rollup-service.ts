import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {EnvironmentService} from '../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {RollupService} from '../interfaces/rollup-service';

@Injectable()
export class PsqlRollupService extends RollupService {
  protected restore(backupFileName: string) {
    const {host, port, name, user, password} = this.environmentService.database;

    try {
      // Command is a constant: every dynamic value flows through `env` and is
      // referenced as a quoted shell variable. Bash does not re-evaluate the
      // contents of an expanded variable, so a malicious filename or db param
      // (e.g. "$(rm -rf /)") is treated literally — no shell injection.
      execSync('set -o pipefail; gunzip -c "$BACKUP_FILE" | psql', {
        env: {
          ...process.env,
          PGHOST: host,
          PGPORT: port,
          PGDATABASE: name,
          PGUSER: user,
          PGPASSWORD: password,
          BACKUP_FILE: backupFileName,
        },
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: '/bin/bash',
      });

      return {ok: true as const, data: {backupFileName}};
    } catch {
      return {ok: false as const, error: new Error('psql restore failed')};
    }
  }

  constructor(
    protected readonly logger: Logger,
    private readonly environmentService: EnvironmentService,
    protected readonly s3StorageService: S3StorageService,
  ) {
    super(logger, s3StorageService);
  }
}
