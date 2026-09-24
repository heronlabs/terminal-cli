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
      dsn: this.configService.get<string>('SENTRY_DSN'),
      environment:
        this.configService.get<string>('SENTRY_ENVIRONMENT') || 'production',
    };
  }

  get release() {
    const path = join(__dirname, '../../../../../package.json');

    const {version} = JSON.parse(readFileSync(path, 'utf-8')) as {
      version: string;
    };

    return `terminal-cli@${version}`;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseUrlService: DatabaseUrlService,
  ) {}
}
