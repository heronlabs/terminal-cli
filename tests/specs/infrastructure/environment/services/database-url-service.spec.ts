import {faker} from '@faker-js/faker';

import {environmentModule} from '../../../../../src/infrastructure/environment/environment-module';
import {DatabaseUrlService} from '../../../../../src/infrastructure/environment/services/database-url-service';
import {
  createTestingModule,
  ssmConfigService,
} from '../../../../__mocks__/create-testing-module';

describe('Given a database URL service', () => {
  let service: DatabaseUrlService;

  beforeEach(async () => {
    const moduleRef = await createTestingModule(environmentModule).compile();

    service = moduleRef.get(DatabaseUrlService);
  });

  it('Should resolve DB_URL through env-ssm getOrThrow', async () => {
    await service.parse();

    expect(ssmConfigService.getOrThrow).toHaveBeenCalledWith('DB_URL');
  });

  it('Should return the original error when DB_URL cannot be resolved', async () => {
    const error = new Error(faker.lorem.sentence());

    ssmConfigService.getOrThrow.mockRejectedValueOnce(error);

    expect(await service.parse()).toEqual({ok: false, error});
  });

  it('Should wrap a non-Error rejection in an Error', async () => {
    ssmConfigService.getOrThrow.mockRejectedValueOnce('boom');

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('boom'),
    });
  });

  it('Should parse the connection URL into the database connection parts', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgres://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a postgresql connection URL into the database connection parts', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgresql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql connection URL into the database connection parts', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped hash', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}#${faker.string.alpha(6)}`;

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped slash', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}/${faker.string.alpha(6)}`;

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should preserve a literal percent in a mysql password verbatim', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}%${faker.string.alpha(2)}`;

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped at sign', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}@${faker.string.alpha(6)}`;

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped colon', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}:${faker.string.alpha(6)}`;

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://${user}:${password}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should default the port to empty when the URL omits it', async () => {
    const host = faker.internet.domainName();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgres://${user}:${password}@${host}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port: '', name, user, password},
    });
  });

  it('Should default the password to empty when the URL omits it', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgres://${user}@${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: true,
      connection: {host, port, name, user, password: ''},
    });
  });

  it('Should fail when the DB_URL is not a valid connection URL', async () => {
    ssmConfigService.getOrThrow.mockResolvedValueOnce(faker.string.alpha(12));

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing host, name, user'),
    });
  });

  it('Should never expose the password in the invalid DB_URL error', async () => {
    const password = faker.string.alphanumeric(16);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `mysql://user:${password}@host:3306`,
    );

    const result = await service.parse();

    expect(result.ok === false && result.error.message.includes(password)).toBe(
      false,
    );
  });

  it('Should fail when the connection URL is missing the host', async () => {
    const name = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(`postgres:///${name}`);

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing host, user'),
    });
  });

  it('Should fail when the connection URL is missing the name', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgres://${user}:${password}@${host}:${port}/`,
    );

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing name'),
    });
  });

  it('Should fail when the connection URL has no path segment', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgres://${user}:${password}@${host}:${port}`,
    );

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing name'),
    });
  });

  it('Should fail when the connection URL is missing the user', async () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);

    ssmConfigService.getOrThrow.mockResolvedValueOnce(
      `postgres://${host}:${port}/${name}`,
    );

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing user'),
    });
  });

  it('Should list every missing field in host, name, user order', async () => {
    ssmConfigService.getOrThrow.mockResolvedValueOnce('postgres:///');

    expect(await service.parse()).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing host, name, user'),
    });
  });
});
