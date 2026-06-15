import {ConfigService as SsmConfigService} from '@heronlabs/env-ssm';
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

import {DatabaseUrlService} from './database-url-service';

@Injectable()
export class EnvironmentService {
  async database() {
    let databaseUrl: string;

    try {
      databaseUrl = await this.ssmConfigService.getOrThrow('DB_URL');
    } catch (error) {
      return {ok: false as const, error: error as Error};
    }

    return this.databaseUrlService.parse(databaseUrl);
  }

  get storage() {
    return {
      bucketName: this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'),
    };
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly ssmConfigService: SsmConfigService,
    private readonly databaseUrlService: DatabaseUrlService,
  ) {}
}
