import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../infrastructure/environment/environment-module';
import {StorageModule} from '../infrastructure/storage/storage-module';
import {MysqlBackupService} from './services/mysql-backup-service';
import {MysqlRollupService} from './services/mysql-rollup-service';
import {PsqlBackupService} from './services/psql-backup-service';
import {PsqlRollupService} from './services/psql-rollup-service';

const coreModule: ModuleMetadata = {
  imports: [EnvironmentModule, StorageModule],
  providers: [
    Logger,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
  exports: [
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
};
@Module(coreModule)
export class CoreModule {}
