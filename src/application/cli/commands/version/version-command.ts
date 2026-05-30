import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {Logger} from '@nestjs/common';
import {Command, CommandRunner} from 'nest-commander';

@Command({name: 'version', description: 'Print current version'})
export class VersionCommand extends CommandRunner {
  public async run(): Promise<void> {
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
