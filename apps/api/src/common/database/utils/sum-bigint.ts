import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export async function sumBigint(
  qb: SelectQueryBuilder<ObjectLiteral>,
  expression: string,
): Promise<bigint> {
  const row = await qb
    .select(`COALESCE(SUM(${expression}), 0)`, 'total')
    .getRawOne<{ total: string }>();
  return BigInt(row?.total ?? 0);
}
