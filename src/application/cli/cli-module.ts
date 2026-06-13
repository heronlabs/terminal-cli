import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {CoreModule} from '../../core/core-module';
import {LogModule} from '../../infrastructure/log/log-module';
import {EasypanelBackupCommand} from './commands/backup/easypanel-backup-command';
import {MysqlBackupCommand} from './commands/backup/mysql-backup-command';
import {PsqlBackupCommand} from './commands/backup/psql-backup-command';
import {EasypanelRollupCommand} from './commands/rollup/easypanel-rollup-command';
import {MysqlRollupCommand} from './commands/rollup/mysql-rollup-command';
import {PsqlRollupCommand} from './commands/rollup/psql-rollup-command';
import {VersionCommand} from './commands/version/version-command';

export const cliModule: ModuleMetadata = {
  imports: [LogModule, CoreModule],
  providers: [
    Logger,
    VersionCommand,
    PsqlBackupCommand,
    PsqlRollupCommand,
    MysqlBackupCommand,
    MysqlRollupCommand,
    EasypanelBackupCommand,
    EasypanelRollupCommand,
  ],
};

@Module(cliModule)
export class CliModule {}
