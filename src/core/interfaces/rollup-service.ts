import {Logger} from '@nestjs/common';
import {rmSync, unlinkSync} from 'fs';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {BackupListService} from '../services/backup-list/backup-list-service';
import {JobResult} from '../types/job';

export type RollupRequest = {
  filename?: string;
  latest: boolean;
  local: boolean;
  force: boolean;
};

export abstract class RollupService {
  protected abstract restore(
    filename: string,
  ): Promise<
    {ok: true; data: {backupFileName: string}} | {ok: false; error: Error}
  >;

  protected abstract countTables(): Promise<
    {ok: true; count: number} | {ok: false; error: Error}
  >;

  public async run(request: RollupRequest): Promise<JobResult> {
    const invalid = this.validate(request);

    if (invalid) {
      return {ok: false, error: invalid, expected: true};
    }

    if (!request.force) {
      const refusal = await this.refuseNonEmptyDatabase();

      if (refusal) {
        return refusal;
      }
    }

    const resolved = await this.resolveFilename(request);

    if (!resolved.ok) {
      this.logger.error(resolved.error.message);
      return resolved;
    }

    return this.downloadAndRestore(resolved.key, request.local);
  }

  protected tableCountFailure() {
    return {
      ok: false as const,
      error: new Error('Could not count the tables of the target database'),
    };
  }

  private validate({filename, latest, local}: RollupRequest) {
    if (Boolean(filename) === latest) {
      return new Error('Pass either --filename or --latest');
    }

    if (latest && local) {
      return new Error(
        '--latest reads from S3 and cannot be combined with --local',
      );
    }

    return undefined;
  }

  private async refuseNonEmptyDatabase(): Promise<JobResult | undefined> {
    const tables = await this.countTables();

    if (!tables.ok) {
      this.logger.error(tables.error.message);
      return tables;
    }

    if (tables.count === 0) {
      return undefined;
    }

    return {
      ok: false,
      error: new Error(
        `Target database is not empty (${tables.count} tables). Restore into an empty database or pass --force`,
      ),
      expected: true,
    };
  }

  private async resolveFilename({filename, latest}: RollupRequest) {
    if (!latest) {
      return {ok: true as const, key: filename as string};
    }

    return this.backupListService.latest();
  }

  private async downloadAndRestore(
    filename: string,
    local: boolean,
  ): Promise<JobResult> {
    if (!local) {
      const {error: downloadError} =
        await this.s3StorageService.download(filename);

      if (downloadError) {
        rmSync(filename, {force: true});
        this.logger.error(downloadError.message);
        return {ok: false, error: downloadError};
      }
    }

    const result = await this.restore(filename);

    if (!result.ok) {
      this.logger.error(result.error.message);
      this.deleteDownloadedFile(filename, local);
      return {ok: false, error: result.error};
    }

    this.logger.log(`Restored ${result.data.backupFileName}`);

    this.deleteDownloadedFile(filename, local);

    return {ok: true};
  }

  private deleteDownloadedFile(filename: string, local: boolean) {
    if (local) {
      return;
    }

    unlinkSync(filename);
    this.logger.log('Deleted downloaded backup file');
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
    protected readonly backupListService: BackupListService,
  ) {}
}
