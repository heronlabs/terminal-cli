import {Logger} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import {unlinkSync} from 'fs';
import {DateTime} from 'luxon';

import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class BackupService {
  protected readonly logger = new Logger(this.constructor.name);

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

  public async run(local: boolean, filename?: string) {
    const monitorSlug = 'terminal-cli-backup';

    const checkInId = Sentry.captureCheckIn({
      monitorSlug,
      status: 'in_progress',
    });

    const result = await this.backup(local, filename);

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug,
      status: result.ok ? 'ok' : 'error',
    });

    return result;
  }

  private async backup(local: boolean, filename?: string) {
    const result = await this.dump(filename);

    if (!result.ok) {
      this.logger.error({err: result.error}, 'Backup dump failed');
      return {ok: false};
    }

    if (local) {
      return {ok: true};
    }

    const {error: uploadError} = await this.s3StorageService.upload(
      result.data.backupFileName,
    );

    unlinkSync(result.data.backupFileName);
    this.logger.log(
      {filename: result.data.backupFileName},
      'Deleted local backup file',
    );

    if (uploadError) {
      this.logger.error(
        {err: uploadError, filename: result.data.backupFileName},
        'Backup upload failed',
      );
      return {ok: false};
    }

    return {ok: true};
  }

  constructor(protected readonly s3StorageService: S3StorageService) {}
}
