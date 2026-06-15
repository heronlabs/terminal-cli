import {faker} from '@faker-js/faker';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {EnvironmentService} from '../../../../../src/infrastructure/environment/services/environment-service';
import {
  configService,
  createTestingModule,
  databaseUrl,
  ssmConfigService,
} from '../../../../__mocks__/create-testing-module';

describe('Given a service', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(EnvironmentService);
  });

  describe('Given database resolution', () => {
    it('Should resolve DB_URL through env-ssm getOrThrow', async () => {
      ssmConfigService.getOrThrow.mockResolvedValueOnce(databaseUrl);

      await service.database();

      expect(ssmConfigService.getOrThrow).toHaveBeenCalledWith('DB_URL');
    });

    it('Should return the original error when DB_URL cannot be resolved', async () => {
      const error = new Error(faker.lorem.sentence());

      ssmConfigService.getOrThrow.mockRejectedValueOnce(error);

      expect(await service.database()).toEqual({ok: false, error});
    });

    it('Should wrap a non-Error rejection in an Error', async () => {
      ssmConfigService.getOrThrow.mockRejectedValueOnce('boom');

      expect(await service.database()).toEqual({
        ok: false,
        error: new Error('boom'),
      });
    });
  });

  describe('Given storage resolution', () => {
    it('Should expose the storage settings as a deep-equal object', () => {
      const bucketName = faker.string.alpha();

      configService.getOrThrow.mockImplementation((key: string) =>
        key === 'AWS_S3_BUCKET_NAME' ? bucketName : key,
      );

      expect(service.storage).toEqual({bucketName});
    });
  });
});
