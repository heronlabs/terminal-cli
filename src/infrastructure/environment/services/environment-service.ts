import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseUrlService: DatabaseUrlService,
  ) {}
}
