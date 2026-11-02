const entityModules = import.meta.glob<Record<string, unknown>>(
  '../../../src/modules/**/*.entity.ts',
  { eager: true },
);

export const integrationEntities = Object.values(entityModules)
  .flatMap((module) => Object.values(module))
  .filter((entity): entity is Function => typeof entity === 'function');
