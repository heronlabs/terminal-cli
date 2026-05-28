import {Logger, Module, ModuleMetadata} from '@nestjs/common';

import {CoreModule} from '../../core/core-module';
import {LogModule} from '../../infrastructure/log/log-module';
import {MysqlBackupCommand} from './commands/backup/mysql-backup-command';
import {PsqlBackupCommand} from './commands/backup/psql-backup-command';
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
  ],
};

@Module(cliModule)
export class CliModule {}
