import {Injectable} from '@nestjs/common';

@Injectable()
export class DatabaseUrlService {
  private splitFirst(
    value: string,
    delimiter: string,
  ): [string, string | undefined] {
    const index = value.indexOf(delimiter);

    if (index === -1) {
      return [value, undefined];
    }

    return [value.slice(0, index), value.slice(index + delimiter.length)];
  }

  private splitLast(value: string, delimiter: string): [string, string] {
    const index = value.lastIndexOf(delimiter);

    if (index === -1) {
      return ['', value];
    }

    return [value.slice(0, index), value.slice(index + delimiter.length)];
  }

  parse(databaseUrl: string) {
    try {
      const [, rest = ''] = this.splitFirst(databaseUrl, '://');

      const [userinfo, remainder] = this.splitLast(rest, '@');
      const [hostport, name = ''] = this.splitFirst(remainder, '/');
      const [user, password = ''] = this.splitFirst(userinfo, ':');
      const [host, port = ''] = this.splitFirst(hostport, ':');

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
    } catch {
      return {ok: false as const, error: new Error('Invalid DB_URL')};
    }
  }
}
