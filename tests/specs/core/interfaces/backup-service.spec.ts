import {Logger} from '@nestjs/common';
import {faker} from '@faker-js/faker';

import {BackupService} from '../../../../src/core/interfaces/backup-service';
import {S3StorageService} from '../../../../src/infrastructure/storage/services/s3-storage-service';

class TestBackupService extends BackupService {
  protected async dump() {
    return {ok: true as const, data: {backupFileName: 'noop'}};
  }

  public resolve(
    filename: string | undefined,
    defaultBaseName: string,
    extension: string,
  ): string {
    return this.resolveBackupFileName(filename, defaultBaseName, extension);
  }
}

describe('Given the backup service abstract base', () => {
  let service: TestBackupService;

  beforeEach(() => {
    service = new TestBackupService(
      {} as Logger,
      {} as S3StorageService,
    );
  });

  describe('Given an explicit filename is provided', () => {
    it('Should return the provided filename unchanged', () => {
      const filename = `${faker.string.alphanumeric(10)}.sql.gz`;

      const result = service.resolve(
        filename,
        faker.string.alphanumeric(8),
        'sql.gz',
      );

      expect(result).toBe(filename);
    });

    it('Should keep an empty-string filename rather than falling back', () => {
      const result = service.resolve('', faker.string.alphanumeric(8), 'sql.gz');

      expect(result).toBe('');
    });
  });

  describe('Given no filename is provided', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-13T09:05:07.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('Should build the name from base, UTC timestamp and extension', () => {
      const result = service.resolve(undefined, 'easypanel', 'tar.gz');

      expect(result).toBe('easypanel-2026-06-13T09-05-07Z.tar.gz');
    });

    it('Should join base name and timestamp with a single hyphen', () => {
      const base = faker.string.alphanumeric(8);

      const result = service.resolve(undefined, base, 'sql.gz');

      expect(result).toBe(`${base}-2026-06-13T09-05-07Z.sql.gz`);
    });

    it('Should separate the timestamp from the extension with a dot', () => {
      const result = service.resolve(undefined, 'db', 'sql.gz');

      expect(result).toBe('db-2026-06-13T09-05-07Z.sql.gz');
    });

    it('Should format the timestamp in UTC ignoring the local zone', () => {
      vi.setSystemTime(new Date('2026-12-31T23:59:58.000Z'));

      const result = service.resolve(undefined, 'db', 'sql.gz');

      expect(result).toBe('db-2026-12-31T23-59-58Z.sql.gz');
    });
  });
});
