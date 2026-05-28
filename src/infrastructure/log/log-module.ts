import {Global, Module, ModuleMetadata} from '@nestjs/common';
import {LoggerModule as PinoModule} from 'nestjs-pino';

const logModule: ModuleMetadata = {
  imports: [PinoModule.forRoot()],
};

@Module(logModule)
@Global()
export class LogModule {}
