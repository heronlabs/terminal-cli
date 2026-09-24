import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../infrastructure/environment/environment-module';
import {StorageModule} from '../infrastructure/storage/storage-module';
import {MysqlBackupService} from './services/mysql/mysql-backup-service';
import {MysqlRollupService} from './services/mysql/mysql-rollup-service';
import {PsqlBackupService} from './services/psql/psql-backup-service';
import {PsqlRollupService} from './services/psql/psql-rollup-service';
import {ScriptLoaderService} from './services/script-loader-service';

const coreModule: ModuleMetadata = {
  imports: [EnvironmentModule, StorageModule],
  providers: [
    Logger,
    ScriptLoaderService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
  exports: [
    ScriptLoaderService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
};
@Module(coreModule)
export class CoreModule {}
