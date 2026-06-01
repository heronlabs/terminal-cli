import {ParameterFactory} from '@heronlabs/env-ssm';
import {Injectable, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

interface DatabaseConnection {
  host: string;
  port: string;
  name: string;
  user: string;
  password: string;
}

@Injectable()
export class EnvironmentService implements OnModuleInit {
  private connection!: DatabaseConnection;

  get database(): DatabaseConnection {
    return this.connection;
  }

  get storage() {
    return {
      bucketName: this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'),
    };
  }

  async onModuleInit() {
    const parameter = await ParameterFactory.make('DB_URL');

    this.connection = this.parse(await parameter.getOrThrow('DB_URL'));
  }

  private parse(databaseUrl: string): DatabaseConnection {
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

  constructor(private readonly configService: ConfigService) {}
}
