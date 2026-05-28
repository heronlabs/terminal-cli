import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  get database() {
    return {
      host: this.configService.getOrThrow<string>('DB_HOST'),
      port: this.configService.getOrThrow<string>('DB_PORT'),
      name: this.configService.getOrThrow<string>('DB_NAME'),
      user: this.configService.getOrThrow<string>('DB_USER'),
      password: this.configService.getOrThrow<string>('DB_PASSWORD'),
    };
  }

  get storage() {
    return {
      bucketName: this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'),
    };
  }

  constructor(private readonly configService: ConfigService) {}
}
