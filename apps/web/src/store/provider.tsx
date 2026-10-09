'use client';

import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from './index';

interface StoreProviderProps {
  children: ReactNode;
}

/**
 * Global Redux StoreProvider client component for ContractFlow.
 * Wraps Next.js App Router tree while keeping Server Components intact.
 */
export function StoreProvider({ children }: StoreProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}
