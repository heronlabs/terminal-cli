import {S3Client} from '@aws-sdk/client-s3';
import {Logger, ModuleMetadata} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Test, TestingModuleBuilder} from '@nestjs/testing';
import {Mock} from 'moq.ts';
import {Mock as ViMock, vi} from 'vitest';

export const loggerService: {
  log: ViMock;
  warn: ViMock;
  error: ViMock;
} = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export const s3Service: {
  send: ViMock;
} = {
  send: vi.fn(),
};

export const configService: {
  get: ViMock;
  getOrThrow: ViMock;
} = {
  get: vi.fn(),
  getOrThrow: vi.fn(),
};

export const ssmGetOrThrow: ViMock = vi.fn();

export const DB_URL = 'postgres://db_user:db_password@db_host:5432/db_name';

export const createTestingModule = (
  metadata: ModuleMetadata,
): TestingModuleBuilder => {
  configService.get.mockImplementation((key: string) => key);
  configService.getOrThrow.mockImplementation((key: string) => key);
  ssmGetOrThrow.mockResolvedValue(DB_URL);

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
    .useValue(configService);

  return moduleRef;
};
