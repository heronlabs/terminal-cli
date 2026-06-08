import {CoreBootstrap} from '@heronlabs/env-ssm';
import {Module, ModuleMetadata} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';

import {EnvironmentService} from './services/environment-service';

export const environmentModule: ModuleMetadata = {
  providers: [EnvironmentService],
  exports: [EnvironmentService],
  imports: [ConfigModule, CoreBootstrap.register('DB_URL')],
};

@Module(environmentModule)
export class EnvironmentModule {}
