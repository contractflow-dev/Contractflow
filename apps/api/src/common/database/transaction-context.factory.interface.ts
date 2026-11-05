import type { EntityManager } from 'typeorm';

export interface ITransactionContextFactory<TransactionContext extends object> {
  create(manager: EntityManager): TransactionContext;
}
