import {Injectable} from '@nestjs/common';
import {AsyncLocalStorage} from 'async_hooks';

import {JobAttributes} from '../types/job-attributes';

@Injectable()
export class JobContextService {
  private readonly storage = new AsyncLocalStorage<JobAttributes>();

  run<T>(attributes: JobAttributes, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(attributes, fn);
  }

  current(): JobAttributes | undefined {
    return this.storage.getStore();
  }
}
