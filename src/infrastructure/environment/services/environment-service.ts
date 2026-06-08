import {SsmConfigService} from '@heronlabs/env-ssm';
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  async database() {
    const databaseUrl = await this.ssmConfigService.getOrThrow('DB_URL');

    let url: URL;

    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error('Invalid DB_URL');
    }

    const connection = {
      host: url.hostname,
      port: url.port,
      name: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };

    const missing = (['host', 'name', 'user'] as const).filter(
      field => connection[field] === '',
    );

    if (missing.length > 0) {
      throw new Error(`Invalid DB_URL: missing ${missing.join(', ')}`);
    }

    return connection;
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
