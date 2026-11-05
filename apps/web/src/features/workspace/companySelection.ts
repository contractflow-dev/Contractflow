export function activeCompanyStorageKey(userId: string): string {
  return `contractflow.activeCompanyId:${userId}`;
}

export function readPersistedActiveCompanyId(
  storage: Pick<Storage, "getItem">,
  userId: string,
): string | null {
  return storage.getItem(activeCompanyStorageKey(userId));
}

export function persistActiveCompanyId(
  storage: Pick<Storage, "setItem">,
  userId: string,
  companyId: string,
): void {
  storage.setItem(activeCompanyStorageKey(userId), companyId);
}

export function clearPersistedActiveCompanyId(
  storage: Pick<Storage, "removeItem">,
  userId: string,
): void {
  storage.removeItem(activeCompanyStorageKey(userId));
}

export function resolveActiveCompanyId(
  availableCompanyIds: readonly string[],
  activeCompanyId: string | null,
  persistedCompanyId: string | null,
): string | null {
  if (activeCompanyId && availableCompanyIds.includes(activeCompanyId)) {
    return activeCompanyId;
  }
  if (persistedCompanyId && availableCompanyIds.includes(persistedCompanyId)) {
    return persistedCompanyId;
  }
  return availableCompanyIds[0] ?? null;
}
