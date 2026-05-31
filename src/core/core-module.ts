import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../infrastructure/environment/environment-module';
import {StorageModule} from '../infrastructure/storage/storage-module';
import {EasypanelBackupService} from './services/easypanel-backup-service';
import {EasypanelRollupService} from './services/easypanel-rollup-service';
import {MysqlBackupService} from './services/mysql-backup-service';
import {MysqlRollupService} from './services/mysql-rollup-service';
import {PsqlBackupService} from './services/psql-backup-service';
import {PsqlRollupService} from './services/psql-rollup-service';

const coreModule: ModuleMetadata = {
  imports: [EnvironmentModule, StorageModule],
  providers: [
    Logger,
    EasypanelBackupService,
    EasypanelRollupService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
  ],
  exports: [
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
