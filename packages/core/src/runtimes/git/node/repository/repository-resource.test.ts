import { ok } from '@emdash/shared';
import { KeyedMutex } from '@emdash/shared/concurrency';
import { describe, expect, it } from 'vitest';
import type { RepositoryIdentity } from '#runtimes/git/node/allocation/identity';
import type { GitOperationContext } from '#runtimes/git/node/exec/operation-context';
import type { IWatchService } from '#services/fs-watch/api';
import type { GitRepository } from './git-repository';
import { RepositoryResource } from './repository-resource';

const identity = {
  repositoryId: 'repo',
  objectStoreId: 'store',
  gitCommonDir: '/repo/.git',
  objectStoreDir: '/repo/.git/objects',
} as unknown as RepositoryIdentity;

const noopWatcher: IWatchService = {
  watch: () => ({ ready: async () => ok(undefined), release: async () => {} }),
  dispose: async () => {},
};

describe('RepositoryResource.fetch', () => {
  it('does not block lane work (status/stage/commit) while the network fetch runs', async () => {
    let finishFetch!: () => void;
    const fetchGate = new Promise<void>((resolve) => (finishFetch = resolve));
    const commands = {
      fetch: async () => {
        await fetchGate;
        return ok(undefined);
      },
      getRefs: async () => ({}),
      getRemotes: async () => ({}),
    } as unknown as GitRepository;
    const repo = await RepositoryResource.create({
      identity,
      commands,
      watcher: noopWatcher,
      objectStoreMutex: new KeyedMutex(),
    });

    const fetching = repo.fetch('origin', {} as GitOperationContext);
    await expect(repo.execute(async () => 'status')).resolves.toBe('status');

    // Object transfers (push/pull) still wait for the fetch.
    let pushed = false;
    const push = repo.execute(async () => (pushed = true), true);
    await Promise.resolve();
    expect(pushed).toBe(false);

    finishFetch();
    await fetching;
    await push;
    expect(pushed).toBe(true);
    await repo.dispose();
  });
});
