import {faker} from '@faker-js/faker';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {EnvironmentService} from '../../../../../src/infrastructure/environment/services/environment-service';
import {
  configService,
  createTestingModule,
} from '../../../../__mocks__/create-testing-module';

describe('Given a service', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(EnvironmentService);
  });

  describe('Given environment', () => {
    it('Should expose the database connection settings as a deep-equal object', () => {
      const host = faker.string.alpha();
      const port = faker.string.numeric();
      const name = faker.string.alpha();
      const user = faker.string.alpha();
      const password = faker.string.alpha();

      configService.getOrThrow.mockImplementation((key: string) => {
        switch (key) {
          case 'DB_HOST':
            return host;
          case 'DB_PORT':
            return port;
          case 'DB_NAME':
            return name;
          case 'DB_USER':
            return user;
          case 'DB_PASSWORD':
            return password;
          default:
            return key;
        }
      });

      expect(service.database).toEqual({host, port, name, user, password});
    });

    it('Should expose the storage settings as a deep-equal object', () => {
      const bucketName = faker.string.alpha();

      configService.getOrThrow.mockImplementation((key: string) =>
        key === 'AWS_S3_BUCKET_NAME' ? bucketName : key,
      );

      expect(service.storage).toEqual({bucketName});
    });
  });
});
