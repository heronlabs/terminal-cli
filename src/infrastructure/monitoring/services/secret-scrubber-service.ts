import {Injectable} from '@nestjs/common';

const REDACTED = '[redacted]';

const RULES: [RegExp, string][] = [
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s:/@"']+:[^\s@/"']+@/gi, `$1${REDACTED}@`],
  [
    /\b(PGPASSWORD|MYSQL_PWD|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|SENTRY_DSN)=[^\s"',]+/g,
    `$1=${REDACTED}`,
  ],
  [/\bAKIA[0-9A-Z]{16}\b/g, REDACTED],
];

@Injectable()
export class SecretScrubberService {
  scrub(text: string): string {
    return RULES.reduce(
      (current, [pattern, replacement]) =>
        current.replace(pattern, replacement),
      text,
    );
  }

  scrubObject<T>(value: T): T {
    return JSON.parse(this.scrub(JSON.stringify(value))) as T;
  }
}
