import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { TypeOrmUnitOfWork } from './typeorm-unit-of-work';

describe('TypeOrmUnitOfWork', () => {
  it('creates one transaction context and runs the operation with it', async () => {
    const manager = {} as EntityManager;
    const context = { contracts: { save: vi.fn().mockResolvedValue('saved') } };
    const create = vi.fn().mockReturnValue(context);
    const transaction = vi.fn(
      async <Result>(work: (manager: EntityManager) => Promise<Result>) =>
        work(manager),
    );
    const unitOfWork = new TypeOrmUnitOfWork(
      { transaction } as unknown as DataSource,
      { create },
    );

    await expect(
      unitOfWork.execute(async (transactionContext) =>
        transactionContext.contracts.save(),
      ),
    ).resolves.toBe('saved');

    expect(transaction).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(manager);
    expect(context.contracts.save).toHaveBeenCalledOnce();
  });

  it('propagates operation failures to the transaction boundary', async () => {
    const failure = new Error('transaction operation failed');
    let operationFailed = false;
    const transaction = vi.fn(
      async <Result>(work: (manager: EntityManager) => Promise<Result>) => {
        try {
          return await work({} as EntityManager);
        } catch (error) {
          operationFailed = true;
          throw error;
        }
      },
    );
    const unitOfWork = new TypeOrmUnitOfWork(
      { transaction } as unknown as DataSource,
      { create: () => ({}) },
    );

    await expect(
      unitOfWork.execute(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(operationFailed).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('uses the same transaction-bound context for multiple writes', async () => {
    const manager = {} as EntityManager;
    const context = {
      contract: { create: vi.fn().mockResolvedValue(undefined) },
      history: { create: vi.fn().mockResolvedValue(undefined) },
      activity: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const createContext = vi.fn().mockReturnValue(context);
    const transaction = vi.fn(
      async <Result>(work: (manager: EntityManager) => Promise<Result>) =>
        work(manager),
    );
    const unitOfWork = new TypeOrmUnitOfWork(
      { transaction } as unknown as DataSource,
      { create: createContext },
    );

    await unitOfWork.execute(async (tx) => {
      await tx.contract.create();
      await tx.history.create();
      await tx.activity.create();
    });

    expect(createContext).toHaveBeenCalledOnce();
    expect(context.contract.create).toHaveBeenCalledOnce();
    expect(context.history.create).toHaveBeenCalledOnce();
    expect(context.activity.create).toHaveBeenCalledOnce();
  });
});
