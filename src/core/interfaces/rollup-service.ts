import {Logger} from '@nestjs/common';
import {rmSync, unlinkSync} from 'fs';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {BackupListService} from '../services/backup-list/backup-list-service';
import {JobResult} from '../types/job';

export type RollupRequest = {
  filename?: string;
  latest: boolean;
  local: boolean;
};

export abstract class RollupService {
  protected abstract restore(
    filename: string,
  ): Promise<
    {ok: true; data: {backupFileName: string}} | {ok: false; error: Error}
  >;

  public async run(request: RollupRequest): Promise<JobResult> {
    const invalid = this.validate(request);

    if (invalid) {
      return {ok: false, error: invalid, expected: true};
    }

    const resolved = await this.resolveFilename(request);

    if (!resolved.ok) {
      this.logger.error(resolved.error.message);
      return resolved;
    }

    return this.downloadAndRestore(resolved.key, request.local);
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
