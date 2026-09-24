import {Global, Module, ModuleMetadata} from '@nestjs/common';
import {LoggerModule as PinoModule} from 'nestjs-pino';

import {MonitoringModule} from '../monitoring/monitoring-module';
import {BridgeLoggerService} from './services/bridge-logger-service';

const logModule: ModuleMetadata = {
  imports: [PinoModule.forRoot(), MonitoringModule],
  providers: [BridgeLoggerService],
  exports: [BridgeLoggerService],
};

@Module(logModule)
@Global()
export class LogModule {}
