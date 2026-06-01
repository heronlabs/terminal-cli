import {Injectable} from '@nestjs/common';
import {readFileSync} from 'fs';
import {join} from 'path';

@Injectable()
export class ScriptLoaderService {
  public load(name: string): string {
    return readFileSync(join(__dirname, '..', 'scripts', `${name}.sh`), 'utf8');
  }
}
