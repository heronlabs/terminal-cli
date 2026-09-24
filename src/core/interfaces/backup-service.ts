import {Logger} from '@nestjs/common';
import {unlinkSync} from 'fs';
import {DateTime} from 'luxon';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';
import {JobResult} from '../types/job';

export abstract class BackupService {
  protected abstract dump(
    filename?: string,
  ): Promise<
    {ok: true; data: {backupFileName: string}} | {ok: false; error: Error}
  >;

  protected resolveBackupFileName(
    filename: string | undefined,
    defaultBaseName: string,
    extension: string,
  ): string {
    const timestamp = DateTime.utc().toFormat("yyyy-MM-dd'T'HH-mm-ss'Z'");

    return filename ?? `${defaultBaseName}-${timestamp}.${extension}`;
  }

  public async run(local: boolean, filename?: string): Promise<JobResult> {
    const result = await this.dump(filename);

    if (!result.ok) {
      this.logger.error(result.error.message);
      return {ok: false, error: result.error};
    }

    if (local) {
      return {ok: true};
    }

    const {error: uploadError} = await this.s3StorageService.upload(
      result.data.backupFileName,
    );

    unlinkSync(result.data.backupFileName);
    this.logger.log('Deleted local backup file');

    if (uploadError) {
      this.logger.error(uploadError.message);
      return {ok: false, error: uploadError};
    }

    return {ok: true};
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
  ) {}
}
