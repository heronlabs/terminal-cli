import {faker} from '@faker-js/faker';

import {DatabaseUrlService} from '../../../../../src/infrastructure/environment/services/database-url-service';

describe('Given a database URL service', () => {
  let service: DatabaseUrlService;

  beforeEach(() => {
    service = new DatabaseUrlService();
  });

  it('Should parse the connection URL into the database connection parts', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    expect(
      service.parse(`postgres://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a postgresql connection URL into the database connection parts', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    expect(
      service.parse(`postgresql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql connection URL into the database connection parts', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    expect(
      service.parse(`mysql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped hash', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}#${faker.string.alpha(6)}`;

    expect(
      service.parse(`mysql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped slash', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}/${faker.string.alpha(6)}`;

    expect(
      service.parse(`mysql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should preserve a literal percent in a mysql password verbatim', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}%${faker.string.alpha(2)}`;

    expect(
      service.parse(`mysql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped at sign', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}@${faker.string.alpha(6)}`;

    expect(
      service.parse(`mysql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should parse a mysql password containing an unescaped colon', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = `${faker.string.alpha(6)}:${faker.string.alpha(6)}`;

    expect(
      service.parse(`mysql://${user}:${password}@${host}:${port}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port, name, user, password},
    });
  });

  it('Should default the port to empty when the URL omits it', () => {
    const host = faker.internet.domainName();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    expect(
      service.parse(`postgres://${user}:${password}@${host}/${name}`),
    ).toEqual({
      ok: true,
      connection: {host, port: '', name, user, password},
    });
  });

  it('Should default the password to empty when the URL omits it', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);
    const user = faker.string.alphanumeric(10);

    expect(service.parse(`postgres://${user}@${host}:${port}/${name}`)).toEqual(
      {
        ok: true,
        connection: {host, port, name, user, password: ''},
      },
    );
  });

  it('Should fail when the DB_URL is not a valid connection URL', () => {
    expect(service.parse(faker.string.alpha(12))).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing host, name, user'),
    });
  });

  it('Should never expose the password in the invalid DB_URL error', () => {
    const password = faker.string.alphanumeric(16);

    const result = service.parse(`mysql://user:${password}@host:3306`);

    expect(result.ok === false && result.error.message.includes(password)).toBe(
      false,
    );
  });

  it('Should fail when the connection URL is missing the host', () => {
    const name = faker.string.alphanumeric(10);

    expect(service.parse(`postgres:///${name}`)).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing host, user'),
    });
  });

  it('Should fail when the connection URL is missing the name', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    expect(
      service.parse(`postgres://${user}:${password}@${host}:${port}/`),
    ).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing name'),
    });
  });

  it('Should fail when the connection URL has no path segment', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const user = faker.string.alphanumeric(10);
    const password = faker.string.alphanumeric(10);

    expect(
      service.parse(`postgres://${user}:${password}@${host}:${port}`),
    ).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing name'),
    });
  });

  it('Should fail when the connection URL is missing the user', () => {
    const host = faker.internet.domainName();
    const port = faker.number.int({min: 1024, max: 65535}).toString();
    const name = faker.string.alphanumeric(10);

    expect(service.parse(`postgres://${host}:${port}/${name}`)).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing user'),
    });
  });

  it('Should list every missing field in host, name, user order', () => {
    expect(service.parse('postgres:///')).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL: missing host, name, user'),
    });
  });

  it('Should fail without leaking when parsing throws an unexpected error', () => {
    expect(service.parse(undefined as unknown as string)).toEqual({
      ok: false,
      error: new Error('Invalid DB_URL'),
    });
  });
});
