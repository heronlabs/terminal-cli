import {faker} from '@faker-js/faker';

import {JobContextService} from '../../../../../src/infrastructure/monitoring/services/job-context-service';

describe('Given a job context', () => {
  const service = new JobContextService();
  const attributes = {
    command: 'psql-backup',
    job: 'backup',
    'job.id': faker.string.uuid(),
    trigger: 'manual',
  };

  it('Should expose the attributes inside run', async () => {
    const seen = await service.run(attributes, async () => service.current());

    expect(seen).toEqual(attributes);
  });

  it('Should expose nothing outside run', () => {
    expect(service.current()).toBeUndefined();
  });

  it('Should return the value of the callback', async () => {
    const value = faker.lorem.word();

    expect(await service.run(attributes, async () => value)).toBe(value);
  });
});
