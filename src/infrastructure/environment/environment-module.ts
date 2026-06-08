import {CoreModule as SsmConfigModule} from '@heronlabs/env-ssm';
import {Module, ModuleMetadata} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';

import {EnvironmentService} from './services/environment-service';

export const environmentModule: ModuleMetadata = {
  providers: [EnvironmentService],
  exports: [EnvironmentService],
  imports: [ConfigModule, SsmConfigModule],
};

@Module(environmentModule)
export class EnvironmentModule {}
