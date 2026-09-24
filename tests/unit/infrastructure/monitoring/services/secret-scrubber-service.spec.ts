import {faker} from '@faker-js/faker';

import {SecretScrubberService} from '../../../../../src/infrastructure/monitoring/services/secret-scrubber-service';

describe('Given a scrubber', () => {
  const service = new SecretScrubberService();

  describe('Given scrub', () => {
    it('Should redact the credentials of a connection url', () => {
      const password = faker.string.alphanumeric(12);

      expect(service.scrub(`postgres://admin:${password}@db:5432/app`)).toBe(
        'postgres://[redacted]@db:5432/app',
      );
    });

    it('Should redact PGPASSWORD assignments', () => {
      expect(service.scrub('PGPASSWORD=s3cret psql')).toBe(
        'PGPASSWORD=[redacted] psql',
      );
    });

    it('Should redact MYSQL_PWD assignments', () => {
      expect(service.scrub('MYSQL_PWD=s3cret')).toBe('MYSQL_PWD=[redacted]');
    });

    it('Should redact AWS_SECRET_ACCESS_KEY assignments', () => {
      expect(service.scrub('AWS_SECRET_ACCESS_KEY=abc/def+ghi')).toBe(
        'AWS_SECRET_ACCESS_KEY=[redacted]',
      );
    });

    it('Should redact AWS access key ids', () => {
      expect(service.scrub('key AKIAABCDEFGHIJKLMNOP used')).toBe(
        'key [redacted] used',
      );
    });

    it('Should keep text without secrets unchanged', () => {
      const text = faker.lorem.sentence();

      expect(service.scrub(text)).toBe(text);
    });
  });

  describe('Given scrubObject', () => {
    it('Should redact a url nested in an object', () => {
      expect(service.scrubObject({message: 'mysql://u:p@h/db failed'})).toEqual(
        {message: 'mysql://[redacted]@h/db failed'},
      );
    });

    it('Should keep a quoted assignment valid JSON', () => {
      expect(service.scrubObject({values: ['PGPASSWORD=x', 'next']})).toEqual({
        values: ['PGPASSWORD=[redacted]', 'next'],
      });
    });
  });
});
