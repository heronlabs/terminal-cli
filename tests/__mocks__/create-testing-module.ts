import {S3Client} from '@aws-sdk/client-s3';
import {faker} from '@faker-js/faker';
import {SsmConfigService} from '@heronlabs/env-ssm';
import {Logger, ModuleMetadata} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Test, TestingModuleBuilder} from '@nestjs/testing';
import {Mock} from 'moq.ts';
import {Mock as ViMock, vi} from 'vitest';

import {ScriptLoaderService} from '../../src/core/services/script-loader-service';

export const loggerService: {
  log: ViMock;
  warn: ViMock;
  error: ViMock;
} = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export const scriptLoaderService: {
  load: ViMock;
} = {
  load: vi.fn(),
};

export const s3Service: {
  send: ViMock;
} = {
  send: vi.fn(),
};

export const configService: {
  getOrThrow: ViMock;
} = {
  getOrThrow: vi.fn(),
};

export const ssmConfigService: {
  getOrThrow: ViMock;
} = {
  getOrThrow: vi.fn(),
};

export const databaseConnection = {
  host: faker.internet.domainName(),
  port: faker.number.int({min: 1024, max: 65535}).toString(),
  name: faker.string.alphanumeric(10),
  user: faker.string.alphanumeric(10),
  password: faker.string.alphanumeric(10),
};

export const databaseUrl = `postgres://${databaseConnection.user}:${databaseConnection.password}@${databaseConnection.host}:${databaseConnection.port}/${databaseConnection.name}`;

export const createTestingModule = (
  metadata: ModuleMetadata,
): TestingModuleBuilder => {
  configService.getOrThrow.mockImplementation((key: string) => key);
  ssmConfigService.getOrThrow.mockResolvedValue(databaseUrl);

  const moduleRef = Test.createTestingModule(metadata);

  moduleRef
    .overrideProvider(S3Client)
    .useValue(
      new Mock<S3Client>()
        .setup(service => service.send)
        .returns(s3Service.send)
        .object(),
    )
    .overrideProvider(Logger)
    .useValue(
      new Mock<Logger>()
        .setup(service => service.warn)
        .returns(loggerService.warn)
        .setup(service => service.log)
        .returns(loggerService.log)
        .setup(service => service.error)
        .returns(loggerService.error)
        .object(),
    )
    .overrideProvider(ConfigService)
    .useValue(configService)
    .overrideProvider(SsmConfigService)
    .useValue(ssmConfigService)
    .overrideProvider(ScriptLoaderService)
    .useValue(scriptLoaderService);

  return moduleRef;
};
