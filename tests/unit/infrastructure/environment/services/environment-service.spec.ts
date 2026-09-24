import {faker} from '@faker-js/faker';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {EnvironmentService} from '../../../../../src/infrastructure/environment/services/environment-service';
import {
  configService,
  createTestingModule,
  databaseConnection,
} from '../../../../__mocks__/create-testing-module';

describe('Given a service', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(EnvironmentService);
  });

  describe('Given database resolution', () => {
    it('Should delegate to the database URL parser', async () => {
      expect(await service.database()).toEqual({
        ok: true,
        connection: databaseConnection,
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
