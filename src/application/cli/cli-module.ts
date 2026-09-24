import {Module} from '@nestjs/common';

import {CoreModule} from '../../core/core-module';
import {LogModule} from '../../infrastructure/log/log-module';
import {MysqlBackupCommand} from './commands/backup/mysql-backup-command';
import {PsqlBackupCommand} from './commands/backup/psql-backup-command';
import {MysqlRollupCommand} from './commands/rollup/mysql-rollup-command';
import {PsqlRollupCommand} from './commands/rollup/psql-rollup-command';
import {VersionCommand} from './commands/version/version-command';

@Module({
  imports: [LogModule, CoreModule],
  providers: [
    VersionCommand,
    PsqlBackupCommand,
    PsqlRollupCommand,
    MysqlBackupCommand,
    MysqlRollupCommand,
  ],
})
export class CliModule {}
