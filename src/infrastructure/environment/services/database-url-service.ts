import {ConfigService} from '@heronlabs/env-ssm';
import {Injectable} from '@nestjs/common';

@Injectable()
export class DatabaseUrlService {
  constructor(private readonly ssmConfigService: ConfigService) {}

  private splitFirst(
    value: string,
    delimiter: string,
  ): [string, string | undefined] {
    const index = value.indexOf(delimiter);

    if (index === -1) {
      return [value, undefined];
    }

    const head = value.slice(0, index);
    const tail = value.slice(index + delimiter.length);

    return [head, tail];
  }

  private splitLast(value: string, delimiter: string): [string, string] {
    const index = value.lastIndexOf(delimiter);

    if (index === -1) {
      return ['', value];
    }

    const head = value.slice(0, index);
    const tail = value.slice(index + delimiter.length);

    return [head, tail];
  }

  private stripNameSuffix(name: string): string {
    const [withoutFragment] = this.splitFirst(name, '#');
    const [withoutQuery] = this.splitFirst(withoutFragment, '?');

    return withoutQuery;
  }

  async parse() {
    try {
      const databaseUrl = await this.ssmConfigService.getOrThrow('DB_URL');

      const [, rest = ''] = this.splitFirst(databaseUrl, '://');

      const [userinfo, remainder] = this.splitLast(rest, '@');
      const [hostport, rawName = ''] = this.splitFirst(remainder, '/');
      const [user, password = ''] = this.splitFirst(userinfo, ':');
      const [host, port = ''] = this.splitFirst(hostport, ':');

      const name = this.stripNameSuffix(rawName);

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
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error : new Error('Invalid DB_URL'),
      };
    }
  }
}
