import {Command, CommandRunner, Option} from 'nest-commander';

import {EasypanelRollupService} from '../../../../core/services/easy-panel/easypanel-rollup-service';
import {RollupOptions, RollupOptionsKeys} from './types/rollup-options';

@Command({
  name: 'easypanel-rollup',
  description:
    'Restore an EasyPanel host from a backup file (S3 by default, or local filesystem with --local). Overwrites host files.',
})
export class EasypanelRollupCommand extends CommandRunner {
  @Option({
    flags: `-f, --${RollupOptionsKeys.FILENAME} <filename>`,
    description:
      'Backup filename to restore (e.g. easypanel-2026-03-05T12-00-00Z.tar.gz)',
    required: true,
  })
  parseFilename(val: string): string {
    return val;
  }

  @Option({
    flags: `--${RollupOptionsKeys.LOCAL}`,
    description:
      'Read backup from the local filesystem instead of S3 (default: S3)',
  })
  parseLocal(): boolean {
    return true;
  }

  public async run(_args: string[], options: RollupOptions) {
    await this.easypanelRollupService.run(
      options[RollupOptionsKeys.FILENAME],
      options[RollupOptionsKeys.LOCAL] ?? false,
    );
  }

  constructor(private readonly easypanelRollupService: EasypanelRollupService) {
    super();
  }
}
