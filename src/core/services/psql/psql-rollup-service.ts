import {Injectable, Logger} from '@nestjs/common';
import {execSync} from 'child_process';

import {DatabaseConnection} from '../../../infrastructure/environment/services/database-url-service';
import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';
import {RollupService} from '../../interfaces/rollup-service';
import {BackupListService} from '../backup-list/backup-list-service';
import {ScriptLoaderService} from '../script-loader-service';

@Injectable()
export class PsqlRollupService extends RollupService {
  protected async restore(backupFileName: string) {
    const db = await this.environmentService.database();

    if (!db.ok) {
      return {ok: false as const, error: db.error};
    }

    try {
      execSync(this.scriptLoader.load('psql', 'psql-rollup'), {
        env: {
          ...this.connectionEnv(db.connection),
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

  protected async countTables() {
    const db = await this.environmentService.database();

    if (!db.ok) {
      return {ok: false as const, error: db.error};
    }

    try {
      const count = Number.parseInt(
        execSync(this.scriptLoader.load('psql', 'psql-count-tables'), {
          env: this.connectionEnv(db.connection),
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
          shell: '/bin/bash',
        }),
        10,
      );

      return Number.isInteger(count)
        ? {ok: true as const, count}
        : this.tableCountFailure();
    } catch {
      return this.tableCountFailure();
    }
  }

  private connectionEnv({
    host,
    port,
    name,
    user,
    password,
  }: DatabaseConnection) {
    return {
      ...process.env,
      PGHOST: host,
      PGPORT: port,
      PGDATABASE: name,
      PGUSER: user,
      PGPASSWORD: password,
    };
  }

  constructor(
    protected readonly logger: Logger,
    private readonly environmentService: EnvironmentService,
    protected readonly s3StorageService: S3StorageService,
    private readonly scriptLoader: ScriptLoaderService,
    protected readonly backupListService: BackupListService,
  ) {
    super(logger, s3StorageService, backupListService);
  }
}
