import {Logger} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import {unlinkSync} from 'fs';
import {DateTime} from 'luxon';

import {redact} from '../../infrastructure/log/redact';
import {S3StorageService} from '../../infrastructure/storage/services/s3-storage-service';

export abstract class BackupService {
  protected abstract readonly engine: 'postgres' | 'mysql';

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
      this.logger.error(
        {
          logId: 'backup.dump-failed',
          engine: this.engine,
          err: result.error,
          errorName: result.error.name,
          errorMessage: redact(result.error.message),
        },
        'backup.dump-failed',
        BackupService.name,
      );
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
      {
        logId: 'backup.local-file-deleted',
        engine: this.engine,
        filename: result.data.backupFileName,
      },
      'backup.local-file-deleted',
      BackupService.name,
    );

    if (uploadError) {
      this.logger.error(
        {
          logId: 'backup.upload-failed',
          engine: this.engine,
          filename: result.data.backupFileName,
          err: uploadError,
          errorName: uploadError.name,
          errorMessage: redact(uploadError.message),
        },
        'backup.upload-failed',
        BackupService.name,
      );
      return {ok: false};
    }

    return {ok: true};
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly s3StorageService: S3StorageService,
  ) {}
}
