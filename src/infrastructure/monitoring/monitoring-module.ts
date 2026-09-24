import {Global, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../environment/environment-module';
import {JobContextService} from './services/job-context-service';
import {MonitoringService} from './services/monitoring-service';
import {SecretScrubberService} from './services/secret-scrubber-service';

export const monitoringModule: ModuleMetadata = {
  imports: [EnvironmentModule],
  providers: [MonitoringService, JobContextService, SecretScrubberService],
  exports: [MonitoringService, JobContextService, SecretScrubberService],
};

@Global()
@Module(monitoringModule)
export class MonitoringModule {}
