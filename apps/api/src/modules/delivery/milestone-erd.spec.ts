import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ActivityLog } from '../cross-cutting/entities/activity-log.entity';
import { ContractStage } from './entities/contract-stage.entity';
import { MilestoneDecision } from './entities/milestone-decision.entity';
import { MilestoneOutstandingItem } from './entities/milestone-outstanding-item.entity';
import { MilestoneSubmissionEvidence } from './entities/milestone-submission-evidence.entity';
import { MilestoneSubmissionItem } from './entities/milestone-submission-item.entity';
import { MilestoneSubmission } from './entities/milestone-submission.entity';
import { Milestone } from './entities/milestone.entity';

/**
 * The ERD in `packages/db/docs` must describe the Stages and Milestones tables
 * (and the activity log they write to) as the entities define them: the same
 * columns, and a relationship for every foreign key.
 */
const ERD = readFileSync(
  join(
    __dirname,
    '../../../../../packages/db/docs/Contractflow Entity Relationship updated.mmd',
  ),
  'utf8',
);

const ENTITIES: Array<[Function, string]> = [
  [ContractStage, 'contract_stage'],
  [Milestone, 'milestone'],
  [MilestoneSubmission, 'milestone_submission'],
  [MilestoneSubmissionEvidence, 'milestone_submission_evidence'],
  [MilestoneDecision, 'milestone_decision'],
  [MilestoneOutstandingItem, 'milestone_outstanding_item'],
  [MilestoneSubmissionItem, 'milestone_submission_item'],
  [ActivityLog, 'activity_log'],
];

/** Columns the ERD leaves out of every entity by convention. */
const IMPLICIT = new Set(['created_at', 'updated_at']);

function erdColumns(table: string): string[] {
  const block = new RegExp(
    `\\n    ${table.toUpperCase()} \\{\\n([\\s\\S]*?)\\n    \\}`,
  ).exec(ERD);
  if (!block) throw new Error(`The ERD has no ${table.toUpperCase()} entity`);
  return block[1]
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[1])
    .filter(Boolean);
}

function entityColumns(target: Function): string[] {
  const storage = getMetadataArgsStorage();
  const chain = [target];
  let parent = Object.getPrototypeOf(target);
  while (parent && parent !== Function.prototype) {
    chain.push(parent);
    parent = Object.getPrototypeOf(parent);
  }
  return storage.columns
    .filter((column) => chain.includes(column.target as Function))
    .map((column) => String(column.options.name ?? column.propertyName));
}

function relationshipLine(a: string, b: string): boolean {
  const [x, y] = [a.toUpperCase(), b.toUpperCase()];
  return ERD.split('\n').some((line) => {
    const match = /^\s+([A-Z_]+) \S+ ([A-Z_]+) :/.exec(line);
    return (
      !!match &&
      ((match[1] === x && match[2] === y) || (match[1] === y && match[2] === x))
    );
  });
}

function tableOf(target: Function): string {
  const table = getMetadataArgsStorage().tables.find(
    (entry) => entry.target === target,
  );
  return String(table?.name);
}

describe('ERD of Stages and Milestones', () => {
  it.each(ENTITIES)('lists the columns of %o (%s)', (target, table) => {
    expect(tableOf(target)).toBe(table);
    const inErd = new Set(erdColumns(table));
    const inEntity = entityColumns(target);

    const missing = inEntity.filter(
      (column) => !IMPLICIT.has(column) && !inErd.has(column),
    );
    const invented = [...inErd].filter((column) => !inEntity.includes(column));
    expect({ missing, invented }).toEqual({ missing: [], invented: [] });
  });

  it.each(ENTITIES)(
    'draws a relationship for each foreign key of %o',
    (target, table) => {
      const relations = getMetadataArgsStorage().relations.filter(
        (relation) =>
          relation.target === target && relation.relationType === 'many-to-one',
      );
      expect(relations.length).toBeGreaterThan(0);
      for (const relation of relations) {
        const type = relation.type as () => Function;
        const referenced = tableOf(type());
        expect(
          relationshipLine(referenced, table),
          `${referenced} → ${table}`,
        ).toBe(true);
      }
    },
  );

  it('draws the foreign keys the migration adds without an entity relation', () => {
    // previous_decision_id is a column on the entity, constrained only in SQL.
    expect(relationshipLine('milestone_decision', 'milestone_submission')).toBe(
      true,
    );
    expect(ERD).toMatch(/uuid previous_decision_id FK/);
  });
});
