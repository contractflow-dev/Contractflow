export interface IUnitOfWork<TransactionContext extends object> {
  execute<Result>(
    operation: (context: TransactionContext) => Promise<Result>,
  ): Promise<Result>;
}
