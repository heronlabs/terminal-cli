import {ConfigService as SsmConfigService} from '@heronlabs/env-ssm';
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

// Splits `value` once at the first `delimiter`, returning [before, after].
// `after` is undefined when the delimiter is absent, distinguishing
// "no delimiter" from "delimiter with an empty tail".
const splitFirst = (
  value: string,
  delimiter: string,
): [string, string | undefined] => {
  // split always yields at least one element, so head is always present.
  const [head, ...tail] = value.split(delimiter) as [string, ...string[]];
  return [head, tail.length > 0 ? tail.join(delimiter) : undefined];
};

// Splits `value` once at the last `delimiter`, returning [before, after].
// `before` is empty when the delimiter is absent.
const splitLast = (value: string, delimiter: string): [string, string] => {
  const parts = value.split(delimiter) as [string, ...string[]];
  const tail = parts.pop() as string;
  return [parts.join(delimiter), tail];
};

@Injectable()
export class EnvironmentService {
  async database(): Promise<
    | {
        ok: true;
        connection: {
          host: string;
          port: string;
          name: string;
          user: string;
          password: string;
        };
      }
    | {ok: false; error: Error}
  > {
    let databaseUrl: string;

    try {
      databaseUrl = await this.ssmConfigService.getOrThrow('DB_URL');
    } catch (error) {
      return {ok: false as const, error: error as Error};
    }

    const [, rest] = splitFirst(databaseUrl, '://');

    if (rest === undefined) {
      return {ok: false as const, error: new Error('Invalid DB_URL')};
    }

    // host/port/name never contain '@', so the last '@' ends the credentials
    // even when the password itself contains '@', '/', '#' or '%'. Credentials
    // are used verbatim (literal, not percent-encoded) — that's how DB_URL is
    // written here, and it's what the engine clients expect as MYSQL_PWD /
    // PGPASSWORD.
    const [userinfo, remainder] = splitLast(rest, '@');
    const [hostport, name = ''] = splitFirst(remainder, '/');
    const [user, password = ''] = splitFirst(userinfo, ':');
    const [host, port = ''] = splitFirst(hostport, ':');

    const connection = {host, port, name, user, password};

    const missing = (['host', 'name', 'user'] as const).filter(
      field => connection[field] === '',
    );

    if (missing.length > 0) {
      return {
        ok: false as const,
        error: new Error(`Invalid DB_URL: missing ${missing.join(', ')}`),
      };
    }

    return {ok: true as const, connection};
  }

  get storage() {
    return {
      bucketName: this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'),
    };
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly ssmConfigService: SsmConfigService,
  ) {}
}
