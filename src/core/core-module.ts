import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {EnvironmentModule} from '../infrastructure/environment/environment-module';
import {MonitoringModule} from '../infrastructure/monitoring/monitoring-module';
import {StorageModule} from '../infrastructure/storage/storage-module';
import {BackupListService} from './services/backup-list/backup-list-service';
import {JobLockService} from './services/job/job-lock-service';
import {JobRunnerService} from './services/job/job-runner-service';
import {MysqlBackupService} from './services/mysql/mysql-backup-service';
import {MysqlRollupService} from './services/mysql/mysql-rollup-service';
import {PsqlBackupService} from './services/psql/psql-backup-service';
import {PsqlRollupService} from './services/psql/psql-rollup-service';
import {BackupScheduleService} from './services/schedule/backup-schedule-service';
import {ScriptLoaderService} from './services/script-loader-service';

const coreModule: ModuleMetadata = {
  imports: [EnvironmentModule, StorageModule, MonitoringModule],
  providers: [
    Logger,
    ScriptLoaderService,
    BackupListService,
    JobLockService,
    JobRunnerService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
    BackupScheduleService,
  ],
  exports: [
    ScriptLoaderService,
    BackupListService,
    JobLockService,
    JobRunnerService,
    MysqlBackupService,
    MysqlRollupService,
    PsqlBackupService,
    PsqlRollupService,
    BackupScheduleService,
  ],
};
@Module(coreModule)
export class CoreModule {}
