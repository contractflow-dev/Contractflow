import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, RootState, store } from './index';

/**
 * Pre-typed hooks for ContractFlow Redux store.
 * Always use these throughout the app instead of plain `useDispatch` and `useSelector`.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<typeof store>();
