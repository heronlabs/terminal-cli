import {Injectable} from '@nestjs/common';

@Injectable()
export class DatabaseUrlService {
  parse(databaseUrl: string) {
    const [, rest] = this.splitFirst(databaseUrl, '://');

    if (rest === undefined) {
      return {ok: false as const, error: new Error('Invalid DB_URL')};
    }

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
  }

  private splitFirst(
    value: string,
    delimiter: string,
  ): [string, string | undefined] {
    const [head, ...tail] = value.split(delimiter) as [string, ...string[]];
    return [head, tail.length > 0 ? tail.join(delimiter) : undefined];
  }

  private splitLast(value: string, delimiter: string): [string, string] {
    const parts = value.split(delimiter) as [string, ...string[]];
    const tail = parts.pop() as string;
    return [parts.join(delimiter), tail];
  }
}
