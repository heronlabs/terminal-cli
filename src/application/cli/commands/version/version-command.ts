import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {Logger} from '@nestjs/common';
import {Command, CommandRunner} from 'nest-commander';

@Command({name: 'version', description: 'Print current version'})
export class VersionCommand extends CommandRunner {
  public async run(): Promise<void> {
    // Resolve package.json relative to this compiled module
    // (bin/src/application/cli/commands/version/) so the version is correct
    // when the CLI is installed globally and run from any directory.
    const path = join(__dirname, '../../../../../../package.json');

    const {version} = JSON.parse(readFileSync(path, 'utf-8')) as {
      version: string;
    };

    this.logger.log(`Current Version: ${version}`);
  }

  constructor(private readonly logger: Logger) {
    super();
  }
}
