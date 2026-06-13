import {ConfigService as SsmConfigService} from '@heronlabs/env-ssm';
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  async database(): Promise<
    | {
        ok: true;
        connection: {
          host: string;
          port: string;
          name: string;
          user: string;
          password: string;
        };
      }
    | {ok: false; error: Error}
  > {
    let databaseUrl: string;

    try {
      databaseUrl = await this.ssmConfigService.getOrThrow('DB_URL');
    } catch (error) {
      return {ok: false as const, error: error as Error};
    }

    let url: URL;

    try {
      url = new URL(databaseUrl);
    } catch {
      return {ok: false as const, error: new Error('Invalid DB_URL')};
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
      return {
        ok: false as const,
        error: new Error(`Invalid DB_URL: missing ${missing.join(', ')}`),
      };
    }

    return {ok: true as const, connection};
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
