import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../infrastructure/environment/environment-module';
import {StorageModule} from '../infrastructure/storage/storage-module';
import {EasypanelBackupService} from './services/easy-panel/easypanel-backup-service';
import {EasypanelRollupService} from './services/easy-panel/easypanel-rollup-service';
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
    EasypanelBackupService,
    EasypanelRollupService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
  exports: [
    ScriptLoaderService,
    EasypanelBackupService,
    EasypanelRollupService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
};
@Module(coreModule)
export class CoreModule {}
