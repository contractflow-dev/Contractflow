import { describe, it, expect } from 'vitest';
import { store } from '../index';
import { setUser, clearUser, logout, selectCurrentUser, selectIsAuthenticated } from '@/features/auth';
import { setStep, setSelectedRole, selectCurrentStep, selectSelectedRole } from '@/features/onboarding';
import { setActiveWorkspaceId, selectActiveWorkspaceId, selectRecentWorkspaceIds } from '@/features/workspace';
import { toggleSidebar, openModal, closeModal, selectSidebarOpen, selectActiveModal } from '@/features/ui';
import { ECompanyRole, EUserStatus } from '@contractflow/contracts-schema';

describe('ContractFlow Redux Store', () => {
  it('should initialize with expected root state', () => {
    const state = store.getState();
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('onboarding');
    expect(state).toHaveProperty('workspace');
    expect(state).toHaveProperty('ui');
    expect(state).toHaveProperty('api');
  });

  describe('Auth Slice', () => {
    it('handles setUser, clearUser, and logout', () => {
      const mockUser = {
        id: 'usr_123',
        email: 'engineer@contractflow.io',
        firstName: 'Jane',
        lastName: 'Doe',
        status: EUserStatus.ACTIVE,
      };

      store.dispatch(setUser(mockUser));
      let state = store.getState();
      expect(selectCurrentUser(state)).toEqual(mockUser);
      expect(selectIsAuthenticated(state)).toBe(true);

      store.dispatch(clearUser());
      state = store.getState();
      expect(selectCurrentUser(state)).toBeNull();
      expect(selectIsAuthenticated(state)).toBe(false);

      store.dispatch(setUser(mockUser));
      store.dispatch(logout());
      state = store.getState();
      expect(selectCurrentUser(state)).toBeNull();
      expect(selectIsAuthenticated(state)).toBe(false);
    });
  });

  describe('Onboarding Slice', () => {
    it('handles step changes and role selection', () => {
      store.dispatch(setStep('role'));
      let state = store.getState();
      expect(selectCurrentStep(state)).toBe('role');

      store.dispatch(setSelectedRole(ECompanyRole.CLIENT_PROJECT_MANAGER));
      state = store.getState();
      expect(selectSelectedRole(state)).toBe(ECompanyRole.CLIENT_PROJECT_MANAGER);
    });
  });

  describe('Workspace Slice', () => {
    it('manages active and recent workspace IDs', () => {
      store.dispatch(setActiveWorkspaceId('comp_001'));
      let state = store.getState();
      expect(selectActiveWorkspaceId(state)).toBe('comp_001');
      expect(selectRecentWorkspaceIds(state)).toContain('comp_001');

      store.dispatch(setActiveWorkspaceId('comp_002'));
      state = store.getState();
      expect(selectActiveWorkspaceId(state)).toBe('comp_002');
      expect(selectRecentWorkspaceIds(state)).toContain('comp_002');
    });
  });

  describe('UI Slice', () => {
    it('toggles sidebar and manages modal state', () => {
      const initialSidebar = selectSidebarOpen(store.getState());
      store.dispatch(toggleSidebar());
      expect(selectSidebarOpen(store.getState())).toBe(!initialSidebar);

      store.dispatch(openModal({ modalId: 'CREATE_CONTRACT_MODAL', payload: { step: 1 } }));
      let state = store.getState();
      expect(selectActiveModal(state)).toBe('CREATE_CONTRACT_MODAL');

      store.dispatch(closeModal());
      state = store.getState();
      expect(selectActiveModal(state)).toBeNull();
    });
  });
});
