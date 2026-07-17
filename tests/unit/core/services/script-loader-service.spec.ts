import {faker} from '@faker-js/faker';
import {readFileSync} from 'fs';
import {join} from 'path';

import {ScriptLoaderService} from '../../../../src/core/services/script-loader-service';

vi.mock('fs', () => ({readFileSync: vi.fn(), unlinkSync: vi.fn()}));

const servicesDir = join(process.cwd(), 'src', 'core', 'services');

describe('Given a service', () => {
  let service: ScriptLoaderService;

  beforeEach(() => {
    service = new ScriptLoaderService();
  });

  describe('Given load', () => {
    it('Should read the named script from the given directory as utf8', () => {
      const dir = faker.string.alphanumeric(10);
      const name = faker.string.alphanumeric(10);

      vi.mocked(readFileSync).mockReturnValueOnce('');

      service.load(dir, name);

      expect(readFileSync).toHaveBeenCalledWith(
        join(servicesDir, dir, `${name}.sh`),
        'utf8',
      );
    });

    it('Should return the exact file content for the named script', () => {
      const dir = faker.string.alphanumeric(10);
      const name = faker.string.alphanumeric(10);
      const content = faker.string.alphanumeric(30);

      vi.mocked(readFileSync).mockReturnValueOnce(content);

      const result = service.load(dir, name);

      expect(result).toBe(content);
    });
  });
});
