import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {readFileSync} from 'fs';
import {join} from 'path';

import {DatabaseUrlService} from './database-url-service';

@Injectable()
export class EnvironmentService {
  database() {
    return this.databaseUrlService.parse();
  }

  get storage() {
    return {
      bucketName: this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'),
    };
  }

  get monitoring() {
    return {
      dsn: this.optional('SENTRY_DSN'),
      environment: this.optional('SENTRY_ENVIRONMENT') ?? 'production',
      monitorSlug: this.optional('SENTRY_MONITOR_SLUG'),
      maxRuntimeMinutes: Number(
        this.optional('SENTRY_MONITOR_MAX_RUNTIME') ?? '60',
      ),
    };
  }

  get schedule() {
    return {
      engine: this.optional('BACKUP_ENGINE'),
      backup: this.optional('BACKUP_SCHEDULE') ?? '0 */12 * * *',
      backupOnStart: this.optional('BACKUP_ON_START') !== 'false',
    };
  }

  get release() {
    const path = join(__dirname, '../../../../../package.json');

    const {version} = JSON.parse(readFileSync(path, 'utf-8')) as {
      version: string;
    };

    return `terminal-cli@${version}`;
  }

  private optional(key: string): string | undefined {
    const value = this.configService.get<string>(key);

    return value === '' ? undefined : value;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseUrlService: DatabaseUrlService,
  ) {}
}
