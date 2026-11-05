import type { DataSource } from 'typeorm';
import type { IUnitOfWork } from '../application/unit-of-work.interface';
import type { ITransactionContextFactory } from './transaction-context.factory.interface';

export class TypeOrmUnitOfWork<
  TransactionContext extends object,
> implements IUnitOfWork<TransactionContext> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly contextFactory: ITransactionContextFactory<TransactionContext>,
  ) {}

  execute<Result>(
    operation: (context: TransactionContext) => Promise<Result>,
  ): Promise<Result> {
    return this.dataSource.transaction((manager) =>
      operation(this.contextFactory.create(manager)),
    );
  }
}
