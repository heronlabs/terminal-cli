import {SsmConfigService} from '@heronlabs/env-ssm';
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  async database() {
    const databaseUrl = await this.ssmConfigService.getOrThrow('DB_URL');

    try {
      const url = new URL(databaseUrl);

      return {
        host: url.hostname,
        port: url.port,
        name: url.pathname.slice(1),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
      };
    } catch {
      throw new Error('Invalid DB_URL');
    }
  }

  get storage() {
    return {
      bucketName: this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'),
    };
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly ssmConfigService: SsmConfigService,
  ) {}
}
