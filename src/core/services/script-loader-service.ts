import {Injectable} from '@nestjs/common';
import {readFileSync} from 'fs';
import {join} from 'path';

@Injectable()
export class ScriptLoaderService {
  public load(dir: string, name: string): string {
    return readFileSync(join(__dirname, dir, `${name}.sh`), 'utf8');
  }
}
