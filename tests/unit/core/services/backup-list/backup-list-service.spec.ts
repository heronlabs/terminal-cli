import {faker} from '@faker-js/faker';

import {cliModule} from '../../../../../src/application/cli/cli-module';
import {BackupListService} from '../../../../../src/core/services/backup-list/backup-list-service';
import {S3StorageService} from '../../../../../src/infrastructure/storage/services/s3-storage-service';
import {
  createTestingModule,
  databaseConnection,
  ssmConfigService,
} from '../../../../__mocks__/create-testing-module';

describe('Given a backup list service', () => {
  let service: BackupListService;

  const s3 = {list: vi.fn()};
  const backup = (key: string, lastModified = faker.date.past()) => ({
    key,
    size: faker.number.int({min: 1, max: 1_000_000}),
    lastModified,
  });
  const ownKey = `${databaseConnection.name}-2026-09-24T12-17-03Z.sql.gz`;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(cliModule)
      .overrideProvider(S3StorageService)
      .useValue(s3)
      .compile();

    service = moduleRef.get(BackupListService);
  });

  describe('Given latest', () => {
    it('Should list with the database name as prefix', async () => {
      s3.list.mockResolvedValueOnce({ok: true, objects: []});

      await service.latest();

      expect(s3.list).toHaveBeenCalledWith(`${databaseConnection.name}-`);
    });

    it('Should return the newest key', async () => {
      s3.list.mockResolvedValueOnce({
        ok: true,
        objects: [
          backup(ownKey, new Date('2026-09-24')),
          backup(
            `${databaseConnection.name}-2026-09-23T12-17-03Z.sql.gz`,
            new Date('2026-09-23'),
          ),
        ],
      });

      expect(await service.latest()).toEqual({ok: true, key: ownKey});
    });

    it('Should keep only backups of the exact database', async () => {
      s3.list.mockResolvedValueOnce({
        ok: true,
        objects: [
          backup(
            `${databaseConnection.name}-staging-2026-09-25T12-17-03Z.sql.gz`,
            new Date('2026-09-25'),
          ),
          backup(ownKey, new Date('2026-09-24')),
        ],
      });

      expect(await service.latest()).toEqual({ok: true, key: ownKey});
    });

    it('Should ignore files that are not gzipped sql backups', async () => {
      s3.list.mockResolvedValueOnce({
        ok: true,
        objects: [
          backup(`${databaseConnection.name}-2026-09-24T12-17-03Z.tar.gz`),
        ],
      });

      expect(await service.latest()).toEqual({
        ok: false,
        error: new Error(`No backups found for ${databaseConnection.name}`),
      });
    });

    it('Should not match a database name with regex characters loosely', async () => {
      ssmConfigService.getOrThrow.mockResolvedValueOnce(
        'postgres://user:pass@host:5432/app.v2',
      );
      s3.list.mockResolvedValueOnce({
        ok: true,
        objects: [backup('appXv2-2026-09-24T12-17-03Z.sql.gz')],
      });

      expect(await service.latest()).toEqual({
        ok: false,
        error: new Error('No backups found for app.v2'),
      });
    });

    it('Should fail when there is no backup', async () => {
      s3.list.mockResolvedValueOnce({ok: true, objects: []});

      expect(await service.latest()).toEqual({
        ok: false,
        error: new Error(`No backups found for ${databaseConnection.name}`),
      });
    });

    it('Should return the database error', async () => {
      const error = new Error(faker.lorem.sentence());

      ssmConfigService.getOrThrow.mockRejectedValueOnce(error);

      expect(await service.latest()).toEqual({ok: false, error});
    });

    it('Should return the S3 error', async () => {
      const error = new Error(faker.lorem.sentence());

      s3.list.mockResolvedValueOnce({ok: false, error});

      expect(await service.latest()).toEqual({ok: false, error});
    });
  });
});
