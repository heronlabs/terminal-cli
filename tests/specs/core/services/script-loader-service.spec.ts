import {faker} from '@faker-js/faker';
import {readFileSync} from 'fs';
import {join} from 'path';

import {cliModule} from '../../../../src/application/cli/cli-module';
import {ScriptLoaderService} from '../../../../src/core/services/script-loader-service';
import {createTestingModule} from '../../../__mocks__/create-testing-module';

vi.mock('fs', () => ({readFileSync: vi.fn(), unlinkSync: vi.fn()}));

const scriptsDir = join(
  process.cwd(),
  'src',
  'core',
  'services',
  '..',
  'scripts',
);

describe('Given a service', () => {
  let service: ScriptLoaderService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule).compile();
    service = moduleRef.get(ScriptLoaderService);
  });

  describe('Given load', () => {
    it('Should read the named script from the scripts directory as utf8', () => {
      const name = faker.string.alphanumeric(10);

      vi.mocked(readFileSync).mockReturnValueOnce('');

      service.load(name);

      expect(readFileSync).toHaveBeenCalledWith(
        join(scriptsDir, `${name}.sh`),
        'utf8',
      );
    });

    it('Should return the exact file content for the named script', () => {
      const name = faker.string.alphanumeric(10);
      const content = faker.string.alphanumeric(30);

      vi.mocked(readFileSync).mockReturnValueOnce(content);

      const result = service.load(name);

      expect(result).toBe(content);
    });
  });
});
