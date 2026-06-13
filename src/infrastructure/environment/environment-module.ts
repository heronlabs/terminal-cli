import {
  ConfigService as SsmConfigService,
  SsmConfigFactory,
} from '@heronlabs/env-ssm';
import {Module, ModuleMetadata} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';

import {EnvironmentService} from './services/environment-service';

export const environmentModule: ModuleMetadata = {
  providers: [
    EnvironmentService,
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
