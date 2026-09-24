import {Injectable} from '@nestjs/common';
import {DateTime} from 'luxon';

import {EnvironmentService} from '../../../infrastructure/environment/services/environment-service';
import {S3StorageService} from '../../../infrastructure/storage/services/s3-storage-service';

const BACKUP_SUFFIX_FORMAT = "yyyy-MM-dd'T'HH-mm-ss'Z.sql.gz'";

@Injectable()
export class BackupListService {
  async list() {
    const db = await this.environmentService.database();

    if (!db.ok) {
      return {ok: false as const, error: db.error};
    }

    const {name} = db.connection;
    const prefix = `${name}-`;
    const result = await this.s3StorageService.list(prefix);

    if (!result.ok) {
      return result;
    }

    return {
      ok: true as const,
      backups: result.objects.filter(
        ({key}) =>
          key.startsWith(prefix) &&
          DateTime.fromFormat(key.slice(prefix.length), BACKUP_SUFFIX_FORMAT)
            .isValid,
      ),
      name,
    };
  }

  async latest() {
    const result = await this.list();

    if (!result.ok) {
      return result;
    }

    const [newest] = result.backups;

    if (!newest) {
      return {
        ok: false as const,
        error: new Error(`No backups found for ${result.name}`),
      };
    }

    return {ok: true as const, key: newest.key};
  }

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly s3StorageService: S3StorageService,
  ) {}
}
