import { describe, expect, it, vi } from 'vitest';
import { ContractLifecycle1792862700000 } from './1792862700000-contract-lifecycle';
import { CompanyInvitationOptionalNames1793100000000 } from './1793100000000-company-invitation-optional-names';

describe('ContractLifecycle1792862700000', () => {
  it('adds a nullable creator-company foreign key with restrictive deletion', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      return [];
    });

    await new ContractLifecycle1792862700000().up({ query } as never);

    expect(statements[0]).toContain(
      'ADD COLUMN "created_by_company_id" character varying(26),',
    );
    expect(statements[0]).toContain(
      'FOREIGN KEY ("created_by_company_id") REFERENCES "company"("id") ON DELETE RESTRICT',
    );
  });
});

describe('CompanyInvitationOptionalNames1793100000000', () => {
  it('makes invitation names nullable without changing existing values', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      return [];
    });

    await new CompanyInvitationOptionalNames1793100000000().up({
      query,
    } as never);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('ALTER COLUMN "first_name" DROP NOT NULL');
    expect(statements[0]).toContain('ALTER COLUMN "last_name" DROP NOT NULL');
    expect(statements[0]).not.toMatch(/UPDATE|DEFAULT|DROP COLUMN/i);
  });

  it('refuses to restore NOT NULL while invitations have missing names', async () => {
    const query = vi.fn().mockResolvedValue([{ count: 1 }]);

    await expect(
      new CompanyInvitationOptionalNames1793100000000().down({
        query,
      } as never),
    ).rejects.toThrow(/invitations without names exist/i);
    expect(query).toHaveBeenCalledOnce();
  });

  it('restores NOT NULL only when every invitation has both names', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      return [{ count: 0 }];
    });

    await new CompanyInvitationOptionalNames1793100000000().down({
      query,
    } as never);

    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain('ALTER COLUMN "first_name" SET NOT NULL');
    expect(statements[1]).toContain('ALTER COLUMN "last_name" SET NOT NULL');
  });
});
