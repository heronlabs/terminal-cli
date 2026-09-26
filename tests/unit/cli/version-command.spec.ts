import {readFileSync} from 'node:fs';

import {faker} from '@faker-js/faker';

import {cliModule} from '../../../src/application/cli/cli-module';
import {VersionCommand} from '../../../src/application/cli/commands/version/version-command';
import {
  createTestingModule,
  loggerService,
} from '../../__mocks__/create-testing-module';

vi.mock('node:fs', () => ({readFileSync: vi.fn()}));

describe('Given a CLI command', () => {
  let command: VersionCommand;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    command = moduleRef.get(VersionCommand);
  });

  describe('Given command version', () => {
    it('Should log the current version under the cli.version-printed logId', async () => {
      const version = faker.string.numeric(1);

      vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify({version}));

      await command.run();

      expect(loggerService.log).toHaveBeenCalledWith(
        {
          logId: 'cli.version-printed',
          version,
        },
        'cli.version-printed',
        'VersionCommand',
      );
    });

    it('Should read from a path ending in package.json', async () => {
      vi.mocked(readFileSync).mockReturnValueOnce(
        JSON.stringify({version: faker.string.numeric(1)}),
      );

      await command.run();

      expect(readFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/package\.json$/),
        'utf-8',
      );
    });
  });
});
