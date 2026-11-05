import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface ArchitectureViolation {
  file: string;
  line: number;
  operation: string;
}

const API_SOURCE_ROOT = resolve(__dirname, '../..');
const MODULES_ROOT = join(API_SOURCE_ROOT, 'modules');
const FORBIDDEN_METHODS = new Set([
  'createQueryBuilder',
  'createQueryRunner',
  'getConnection',
  'getManager',
  'getRepository',
  'query',
]);
const FORBIDDEN_ORM_TYPES = new Set([
  'DataSource',
  'EntityManager',
  'QueryRunner',
  'Repository',
  'SelectQueryBuilder',
]);

function applicationServiceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const entryPath = join(directory, entry);
    if (!statSync(entryPath).isDirectory()) continue;
    if (entry === 'services') {
      files.push(
        ...walkTypeScriptFiles(entryPath).filter(
          (file) =>
            file.endsWith('.ts') &&
            !file.endsWith('.spec.ts') &&
            !file.endsWith('.integration.spec.ts'),
        ),
      );
    } else {
      files.push(...applicationServiceFiles(entryPath));
    }
  }
  return files;
}

function walkTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      return walkTypeScriptFiles(entryPath);
    }
    return entryPath.endsWith('.ts') ? [entryPath] : [];
  });
}

function inspectServiceSource(
  file: string,
  sourceText: string,
): ArchitectureViolation[] {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: ArchitectureViolation[] = [];
  const report = (node: ts.Node, operation: string) => {
    violations.push({
      file,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      operation,
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const sourceModule = node.moduleSpecifier.text;
      if (sourceModule === 'typeorm') {
        report(node, 'imports TypeORM');
      }
      if (
        sourceModule === '@nestjs/typeorm' &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.some((specifier) =>
          [
            'InjectRepository',
            'InjectDataSource',
            'InjectEntityManager',
          ].includes(specifier.name.text),
        )
      ) {
        report(node, `injects persistence through ${sourceModule}`);
      }
    }

    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName.getText(source).split('.').pop();
      if (typeName && FORBIDDEN_ORM_TYPES.has(typeName)) {
        report(node, `uses TypeORM type ${typeName}`);
      }
    }

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const methodName = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : ts.isIdentifier(expression)
          ? expression.text
          : '';
      if (FORBIDDEN_METHODS.has(methodName)) {
        report(node, `calls database operation ${methodName}`);
      }
      if (methodName === 'transaction') {
        report(node, 'starts a database transaction outside UnitOfWork');
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

describe('application service persistence boundaries', () => {
  it('keeps TypeORM and direct database operations out of application services', () => {
    const files = applicationServiceFiles(MODULES_ROOT);
    const violations = files.flatMap((file) =>
      inspectServiceSource(
        relative(API_SOURCE_ROOT, file),
        readFileSync(file, 'utf8'),
      ),
    );

    expect(
      violations,
      violations
        .map(({ file, line, operation }) => `${file}:${line}: ${operation}`)
        .join('\n'),
    ).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
  });

  it('identifies direct TypeORM imports and database operations', () => {
    const violations = inspectServiceSource(
      'modules/example/services/example.service.ts',
      [
        "import { DataSource } from 'typeorm';",
        'class ExampleService {',
        '  constructor(private readonly dataSource: DataSource) {}',
        '  load() { return this.dataSource.getRepository(Example).find(); }',
        '}',
      ].join('\n'),
    );

    expect(violations.map(({ operation }) => operation)).toEqual([
      'imports TypeORM',
      'uses TypeORM type DataSource',
      'calls database operation getRepository',
    ]);
  });

  it('keeps TypeORM objects out of application persistence interfaces', () => {
    const files = walkTypeScriptFiles(MODULES_ROOT).filter((file) => {
      const name = basename(file).toLowerCase();
      return (
        file.split(/[\\/]/).includes('interfaces') &&
        (name.includes('persistence.interface') ||
          name.includes('transaction-context.interface'))
      );
    });
    const violations = files.flatMap((file) =>
      inspectServiceSource(
        relative(API_SOURCE_ROOT, file),
        readFileSync(file, 'utf8'),
      ),
    );

    expect(
      violations,
      violations
        .map(({ file, line, operation }) => `${file}:${line}: ${operation}`)
        .join('\n'),
    ).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
  });
});
