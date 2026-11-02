import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

type FailureTriggerTarget =
  | {
      table: 'contract_status_history';
      contractId: string;
      marker: string;
      column: 'reason';
    }
  | {
      table: 'activity_log';
      contractId: string;
      marker: string;
      column: 'action';
    };

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function installPostgresFailureTrigger(
  dataSource: DataSource,
  target: FailureTriggerTarget,
): Promise<() => Promise<void>> {
  const suffix = randomUUID().replaceAll('-', '');
  const triggerName = `cf_it_fail_${suffix}`;
  const functionName = `cf_it_raise_${suffix}`;
  const condition =
    target.table === 'contract_status_history'
      ? `NEW.contract_id = ${quoteLiteral(target.contractId)} AND NEW.reason = ${quoteLiteral(target.marker)}`
      : `NEW.contract_id = ${quoteLiteral(target.contractId)} AND NEW.action = ${quoteLiteral(target.marker)}`;

  await dataSource.query(`
    CREATE FUNCTION public."${functionName}"()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $test_failure$
    BEGIN
      IF ${condition} THEN
        RAISE EXCEPTION 'intentional integration-test constraint failure'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $test_failure$
  `);

  try {
    await dataSource.query(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT ON public."${target.table}"
      FOR EACH ROW
      EXECUTE FUNCTION public."${functionName}"()
    `);
  } catch (error) {
    await dataSource.query(
      `DROP FUNCTION IF EXISTS public."${functionName}"()`,
    );
    throw error;
  }

  return async () => {
    await dataSource.query(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON public."${target.table}"`,
    );
    await dataSource.query(
      `DROP FUNCTION IF EXISTS public."${functionName}"()`,
    );
  };
}
