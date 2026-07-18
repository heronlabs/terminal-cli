import {
  ConfigService as SsmConfigService,
  SsmConfigFactory,
} from '@heronlabs/env-ssm';
import {Module, ModuleMetadata} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';

import {DatabaseUrlService} from './services/database-url-service';
import {EnvironmentService} from './services/environment-service';

export const environmentModule: ModuleMetadata = {
  providers: [
    EnvironmentService,
    DatabaseUrlService,
    {
      provide: SsmConfigService,
      useValue: SsmConfigFactory.make(),
    },
  ],
  exports: [EnvironmentService],
  imports: [ConfigModule],
};

@Module(environmentModule)
export class EnvironmentModule {}
