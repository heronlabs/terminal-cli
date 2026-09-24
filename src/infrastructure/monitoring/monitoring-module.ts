import {Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../environment/environment-module';
import {MonitoringService} from './services/monitoring-service';

export const monitoringModule: ModuleMetadata = {
  imports: [EnvironmentModule],
  providers: [MonitoringService],
  exports: [MonitoringService],
};

@Module(monitoringModule)
export class MonitoringModule {}
